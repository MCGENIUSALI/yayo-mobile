#!/usr/bin/env node
/**
 * Vérifie l'API YA YO depuis un ordinateur qui peut la joindre, et enregistre
 * la forme réelle des réponses (les noms et types des champs) dans api-check.json.
 * La description OpenAPI du serveur ne détaille pas ses réponses (Product, Order…
 * y sont vides) : ce fichier sert à écrire les conversions de l'app sans deviner.
 *
 *   npm run api:check                         lectures publiques seulement
 *   npm run api:check -- --phone +243812345678 connexion par SMS (demande le code reçu)
 *
 * Aucune écriture n'est faite sur le serveur hors connexion : pas de commande,
 * pas de produit. Les jetons ne sont jamais écrits dans le fichier.
 */
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const BASE = (process.env.EXPO_PUBLIC_API_URL || 'https://yayo-backend.fly.dev').replace(/\/$/, '');
const args = process.argv.slice(2);
const phone = args.includes('--phone') ? args[args.indexOf('--phone') + 1] : undefined;
const SECRET = /token|secret|password|otp|code$/i;

/** Field names and types of a JSON value, with short samples for strings and numbers. */
function shape(v, depth = 0) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), `… ${v.length} élément(s)`] : ['(vide)'];
  if (typeof v === 'object') {
    if (depth > 5) return 'object';
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET.test(k) && typeof x === 'string' ? 'string (masqué)' : shape(x, depth + 1)]));
  }
  if (typeof v === 'string') return `string « ${v.length > 40 ? v.slice(0, 40) + '…' : v} »`;
  return `${typeof v} ${String(v)}`;
}

const report = { base: BASE, at: new Date().toISOString(), calls: [] };

async function call(method, path, { body, token } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = undefined;
    }
    const entry = { method, path, status: res.status, ms: Date.now() - started, shape: json === undefined ? `texte : ${text.slice(0, 120)}` : shape(json) };
    report.calls.push(entry);
    console.log(`${res.status}  ${method} ${path}  (${entry.ms} ms)`);
    return { status: res.status, json };
  } catch (e) {
    report.calls.push({ method, path, error: String(e) });
    console.log(`ERREUR  ${method} ${path}  ${e}`);
    return { status: 0, json: undefined };
  }
}

const firstId = (list) => {
  const items = Array.isArray(list) ? list : (list?.data ?? list?.items ?? list?.results ?? list?.products ?? list?.content ?? []);
  const x = Array.isArray(items) ? items[0] : undefined;
  return x?.id ?? x?._id;
};

await call('GET', '/health');
const cats = await call('GET', '/categories');
const products = await call('GET', '/products?page=1&limit=3');
const productId = firstId(products.json);
if (productId) {
  await call('GET', `/products/${productId}`);
  await call('GET', `/content/product/${productId}`);
}
await call('GET', '/content/feed?page=1&limit=3');
const vendors = await call('GET', '/users/vendors');
const vendorId = firstId(vendors.json);
if (vendorId) {
  await call('GET', `/users/vendor/${vendorId}`);
  await call('GET', `/content/vendor/${vendorId}`);
  await call('GET', `/collections/vendor/${vendorId}`);
  await call('GET', `/creators/${vendorId}`);
}
if (firstId(cats.json)) await call('GET', `/categories/${firstId(cats.json)}`);
await call('GET', '/orders/fees');

if (phone) {
  const req = await call('POST', '/auth/otp/request', { body: { phoneE164: phone } });
  const challengeId = req.json?.challengeId;
  if (challengeId) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const code = (await rl.question('Code reçu par SMS : ')).trim();
    rl.close();
    const ver = await call('POST', '/auth/otp/verify', { body: { challengeId, code } });
    const token = ver.json?.accessToken ?? ver.json?.access_token ?? ver.json?.token ?? ver.json?.tokens?.accessToken;
    if (token) {
      const refresh = ver.json?.refreshToken ?? ver.json?.refresh_token ?? ver.json?.tokens?.refreshToken;
      // Hypothèse de l'app : le jeton de rafraîchissement se passe en Bearer (la spec ne décrit pas le corps).
      if (refresh) await call('POST', '/auth/refresh', { token: refresh });
      for (const p of ['/auth/profile', '/users/addresses', '/users/my-wishlist', '/cart', '/orders', '/disputes/my', '/follows/me', '/users/recent-products']) {
        await call('GET', p, { token });
      }
    } else {
      console.log('Pas de jeton reconnu dans la réponse de /auth/otp/verify : voir api-check.json.');
    }
  } else {
    console.log('Pas de challengeId dans la réponse de /auth/otp/request : voir api-check.json.');
  }
}

writeFileSync('api-check.json', JSON.stringify(report, null, 2));
console.log('\nRésultat écrit dans api-check.json. Envoie ce fichier (il ne contient aucun jeton).');
