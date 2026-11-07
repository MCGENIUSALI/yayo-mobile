/**
 * Démo ou serveur. Sans EXPO_PUBLIC_API_URL, l'app reste en mode démo
 * (tout est simulé sur le téléphone). Avec, les parties branchées appellent
 * l'API YA YO, par exemple :
 *   EXPO_PUBLIC_API_URL=https://yayo-backend.fly.dev npm run mobile
 */
export const API_URL: string | null = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);

export const isServerMode = (): boolean => API_URL !== null;

export function normalizeBaseUrl(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (!/^https?:\/\//.test(v)) return null;
  return v.replace(/\/+$/, '');
}
