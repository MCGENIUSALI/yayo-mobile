/**
 * Builds src/domain/geo/data/cd.json from the Référentiel Géographique Commun
 * (OCHA RDC), as republished by geoBoundaries (gbOpen COD ADM1 + ADM2,
 * CC BY 3.0 IGO). Run again when the source is updated:
 *
 *   node scripts/geo/build-cd.mjs
 *
 * ADM1 = 26 provinces (ISO 3166-2:CD), ADM2 = villes et territoires. Each
 * ADM2 is placed in the province that contains its mean point, or most of its boundary points.
 * Communes are not in the RGC levels 0–2: they come from communes-cd.json,
 * kept by hand with a source for each city.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/COD';

/** Official French names (Constitution 2006, art. 2) by ISO 3166-2 code. */
const PROVINCES_FR = {
  'CD-BU': 'Bas-Uele', 'CD-EQ': 'Équateur', 'CD-HK': 'Haut-Katanga', 'CD-HL': 'Haut-Lomami', 'CD-HU': 'Haut-Uele',
  'CD-IT': 'Ituri', 'CD-KS': 'Kasaï', 'CD-KC': 'Kasaï-Central', 'CD-KE': 'Kasaï-Oriental', 'CD-KN': 'Kinshasa',
  'CD-BC': 'Kongo-Central', 'CD-KG': 'Kwango', 'CD-KL': 'Kwilu', 'CD-LO': 'Lomami', 'CD-LU': 'Lualaba',
  'CD-MN': 'Mai-Ndombe', 'CD-MA': 'Maniema', 'CD-MO': 'Mongala', 'CD-NK': 'Nord-Kivu', 'CD-NU': 'Nord-Ubangi',
  'CD-SA': 'Sankuru', 'CD-SK': 'Sud-Kivu', 'CD-SU': 'Sud-Ubangi', 'CD-TA': 'Tanganyika', 'CD-TO': 'Tshopo', 'CD-TU': 'Tshuapa',
};

/** Cities on a provincial border that the geometry places wrongly. Bandundu is the chef-lieu of Kwilu. */
const OVERRIDES = { Bandundu: 'CD-KL' };

async function get(level) {
  const res = await fetch(`${BASE}/${level}/geoBoundaries-COD-${level}_simplified.geojson`);
  if (!res.ok) throw new Error(`${level}: HTTP ${res.status}`);
  return res.json();
}

const rings = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates);
function inPolygon([x, y], polygon) {
  let inside = false;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const adm1 = await get('ADM1');
const adm2 = await get('ADM2');
const provinces = adm1.features.map((f) => {
  const iso = f.properties.shapeISO;
  if (!PROVINCES_FR[iso]) throw new Error(`Unknown province ${iso} (${f.properties.shapeName})`);
  return { iso, name: PROVINCES_FR[iso], polygons: rings(f.geometry), cities: [] };
});
if (provinces.length !== 26) throw new Error(`Expected 26 provinces, got ${provinces.length}`);

for (const f of adm2.features) {
  const points = rings(f.geometry).flatMap((p) => p[0]);
  const step = Math.max(1, Math.floor(points.length / 60));
  const votes = new Map();
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    for (const prov of provinces) if (prov.polygons.some((poly) => inPolygon(p, poly))) votes.set(prov, (votes.get(prov) ?? 0) + 1);
  }
  // The mean point decides when it falls inside one province (small cities on a border, e.g. Goma);
  // otherwise the boundary points vote.
  const mean = points.reduce(([x, y], [px, py]) => [x + px / points.length, y + py / points.length], [0, 0]);
  const byMean = provinces.filter((prov) => prov.polygons.some((poly) => inPolygon(mean, poly)));
  const forced = provinces.find((prov) => prov.iso === OVERRIDES[f.properties.shapeName]);
  const best = forced ?? (byMean.length === 1 ? byMean[0] : [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]);
  if (!best) throw new Error(`No province for ${f.properties.shapeName}`);
  best.cities.push(f.properties.shapeName);
}

const communes = JSON.parse(readFileSync(join(here, 'communes-cd.json'), 'utf8'));
const data = {
  country: 'CD',
  source: 'Référentiel Géographique Commun (OCHA RDC) via geoBoundaries gbOpen COD ADM1/ADM2, CC BY 3.0 IGO',
  version: adm2.features.length + '-' + new Date().toISOString().slice(0, 10),
  provinces: provinces
    .map((p) => ({
      id: p.iso,
      name: p.name,
      cities: p.cities
        .sort((a, b) => a.localeCompare(b, 'fr'))
        .map((name) => ({ name, communes: communes.cities[`${p.iso}/${name}`]?.communes })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
};
for (const key of Object.keys(communes.cities)) {
  const [iso, city] = key.split('/');
  if (!data.provinces.find((p) => p.id === iso)?.cities.find((c) => c.name === city)) throw new Error(`Communes for unknown city ${key}`);
}
writeFileSync(join(here, '../../src/domain/geo/data/cd.json'), JSON.stringify(data) + '\n');
console.log(data.provinces.map((p) => `${p.name}: ${p.cities.length}`).join('\n'));
