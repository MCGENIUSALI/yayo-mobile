import cd from './data/cd.json';

/**
 * Administrative divisions used by every address of the app (buyer profile
 * and delivery address, shop location, courier zones).
 *
 * Source for the RDC: Référentiel Géographique Commun (OCHA RDC, levels 1–2:
 * the 26 provinces and their villes / territoires), via geoBoundaries,
 * CC BY 3.0 IGO. Communes (the level below a ville) are only listed for the
 * cities whose official list is referenced in scripts/geo/communes-cd.json;
 * elsewhere the commune is not asked and the quartier says where.
 * Rebuilt with `node scripts/geo/build-cd.mjs`; a newer dataset can also be
 * served by the backend (see src/store/geo.ts). Nothing here is typed by hand
 * from memory: a name missing from the dataset is not offered.
 */

export interface GeoCity {
  name: string;
  /** Official communes, when referenced. */
  communes?: string[];
}

export interface GeoProvince {
  /** ISO 3166-2 code, e.g. "CD-KN". */
  id: string;
  name: string;
  cities: GeoCity[];
}

export interface GeoDataset {
  country: string;
  source: string;
  version: string;
  provinces: GeoProvince[];
}

export interface GeoCountry {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  flag: string;
}

/** Countries with a verified dataset. Others are added with their own dataset, never with a guessed list. */
export const GEO_COUNTRIES: GeoCountry[] = [{ code: 'CD', name: 'République démocratique du Congo', flag: '🇨🇩' }];

export const BUNDLED_GEO: Record<string, GeoDataset> = { CD: cd as GeoDataset };

/** A place picked through the dependent fields (pays → province → ville → commune), plus free text. */
export interface Place {
  country: string;
  /** Province name (as in the dataset). */
  province: string;
  /** Ville or territoire. */
  city: string;
  /** Required when the city has referenced communes. */
  commune?: string;
  quartier?: string;
  /** Avenue and number, landmark. */
  street?: string;
}

export const DEFAULT_COUNTRY = 'CD';

export const findProvince = (ds: GeoDataset | undefined, province: string | undefined) => ds?.provinces.find((p) => p.name === province);
export const findCity = (ds: GeoDataset | undefined, province: string | undefined, city: string | undefined) =>
  findProvince(ds, province)?.cities.find((c) => c.name === city);

export const provinceNames = (ds: GeoDataset | undefined): string[] => ds?.provinces.map((p) => p.name) ?? [];
export const cityNames = (ds: GeoDataset | undefined, province: string | undefined): string[] => findProvince(ds, province)?.cities.map((c) => c.name) ?? [];
export const communeNames = (ds: GeoDataset | undefined, province: string | undefined, city: string | undefined): string[] =>
  findCity(ds, province, city)?.communes ?? [];

/** The province of a city name (first match), for older records that only kept the city. */
export function provinceOfCity(ds: GeoDataset | undefined, city: string | undefined): string | undefined {
  return ds?.provinces.find((p) => p.cities.some((c) => c.name === city))?.name;
}

/** Fills what older records left out: the RDC as country, the province found from the city. */
export function completePlace<T extends Partial<Place>>(place: T): T & { country: string } {
  const country = place.country ?? DEFAULT_COUNTRY;
  const province = place.province ?? provinceOfCity(BUNDLED_GEO[country], place.city);
  return { ...place, country, province };
}

/** Changing a level clears the levels under it, so a commune never belongs to another city. */
export function changePlace(place: Partial<Place>, level: 'country' | 'province' | 'city' | 'commune', value: string): Partial<Place> {
  switch (level) {
    case 'country':
      return value === place.country ? place : { country: value, quartier: place.quartier, street: place.street };
    case 'province':
      return value === place.province ? place : { ...place, province: value, city: undefined, commune: undefined };
    case 'city':
      return value === place.city ? place : { ...place, city: value, commune: undefined };
    case 'commune':
      return { ...place, commune: value };
  }
}

export type PlaceField = 'country' | 'province' | 'city' | 'commune' | 'quartier';

/** First missing or invalid level, with the message shown under it. */
export function placeError(ds: GeoDataset | undefined, place: Partial<Place>, opts: { quartier?: 'required' | 'optional' } = {}): { field: PlaceField; message: string } | null {
  if (!place.country || !GEO_COUNTRIES.some((c) => c.code === place.country)) return { field: 'country', message: 'Choisis ton pays.' };
  if (!ds || !findProvince(ds, place.province)) return { field: 'province', message: 'Choisis ta province.' };
  const city = findCity(ds, place.province, place.city);
  if (!city) return { field: 'city', message: 'Choisis ta ville ou ton territoire.' };
  const hasCommunes = !!city.communes?.length;
  if (hasCommunes && !city.communes!.includes(place.commune ?? '')) return { field: 'commune', message: 'Choisis ta commune.' };
  // Without an official commune list, the quartier is what locates the address.
  if ((opts.quartier === 'required' || !hasCommunes) && (place.quartier?.trim().length ?? 0) < 2) return { field: 'quartier', message: 'Indique ton quartier.' };
  return null;
}

/** Delivery line: "12, av. Kasa-Vubu, Q. Matonge, Kalamu" (+ ville outside Kinshasa). */
export function addressLine(place: Partial<Place>): string {
  const parts = [place.street?.trim(), place.quartier?.trim() ? `Q. ${place.quartier.trim()}` : undefined, place.commune];
  if (place.city && place.city !== 'Kinshasa') parts.push(place.city);
  return parts.filter(Boolean).join(', ');
}

/** "Kalamu, Kinshasa" / "Q. Majengo, Goma" / "Beni, Nord-Kivu". */
export function placeLabel(place: Partial<Place>): string {
  const local = place.commune ?? (place.quartier ? `Q. ${place.quartier}` : undefined);
  if (local && place.city) return `${local}, ${place.city}`;
  if (place.city && place.province && place.city !== place.province) return `${place.city}, ${place.province}`;
  return place.city ?? place.province ?? '';
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

/** Accent- and punctuation-insensitive search: "kasai or" finds "Kasaï-Oriental", "mont nga" finds "Mont-Ngafula". Prefix matches first. */
export function searchNames(names: string[], query: string): string[] {
  const words = query.trim().split(/\s+/).map(fold).filter(Boolean);
  if (words.length === 0) return names;
  const scored = names
    .map((name) => {
      const f = fold(name);
      if (!words.every((w) => f.includes(w))) return null;
      return { name, rank: f.startsWith(words[0]!) ? 0 : 1 };
    })
    .filter((x): x is { name: string; rank: number } => x !== null);
  return scored.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'fr')).map((x) => x.name);
}

/** Version check for a dataset served by the backend: newer replaces the bundled one. */
export function isValidDataset(x: unknown, country: string): x is GeoDataset {
  const d = x as GeoDataset | null;
  return (
    !!d &&
    d.country === country &&
    typeof d.version === 'string' &&
    Array.isArray(d.provinces) &&
    d.provinces.length > 0 &&
    d.provinces.every((p) => typeof p.name === 'string' && Array.isArray(p.cities) && p.cities.every((c) => typeof c.name === 'string'))
  );
}
