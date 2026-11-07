import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { BUNDLED_GEO, isValidDataset, type GeoDataset } from '@/domain/geo';

/**
 * Geographic reference at run time, offline first:
 * 1. memory (this session), 2. the copy saved on the phone, 3. the dataset
 * shipped in the app. When `EXPO_PUBLIC_GEO_URL` is set (backend endpoint,
 * `{country}` replaced by the ISO code), a newer dataset is fetched once per
 * session in the background, checked, and saved for the next launches. A
 * network error never blocks a form: the shipped dataset stays in use.
 */
const memory = new Map<string, GeoDataset>();
const fetched = new Set<string>();
const storageKey = (country: string) => `yayo/geo/${country}`;
const REMOTE = process.env.EXPO_PUBLIC_GEO_URL;

/** "189-2026-11-07" → "2026-11-07": datasets are compared by build date. */
const builtOn = (d: GeoDataset) => d.version.split('-').slice(1).join('-');
const newer = (a: GeoDataset, b: GeoDataset | undefined) => !b || builtOn(a) > builtOn(b);

export type GeoStatus = { status: 'loading' } | { status: 'ready'; data: GeoDataset } | { status: 'error'; message: string };

function initial(country: string): GeoStatus {
  const data = memory.get(country) ?? BUNDLED_GEO[country];
  return data ? { status: 'ready', data } : { status: 'loading' };
}

export function useGeo(country: string): GeoStatus & { retry: () => void } {
  const [state, setState] = useState<GeoStatus>(() => initial(country));
  const [attempt, setAttempt] = useState(0);
  const [shownFor, setShownFor] = useState(country);
  if (shownFor !== country) {
    setShownFor(country);
    setState(initial(country));
  }

  useEffect(() => {
    let cancelled = false;
    const adopt = (data: GeoDataset) => {
      const current = memory.get(country) ?? BUNDLED_GEO[country];
      if (!newer(data, current) && current) return;
      memory.set(country, data);
      if (!cancelled) setState({ status: 'ready', data });
    };
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(country));
        const saved: unknown = raw ? JSON.parse(raw) : null;
        if (isValidDataset(saved, country)) adopt(saved);
      } catch {
        // A broken saved copy is ignored: the shipped dataset is used.
      }
      if (!REMOTE || fetched.has(country)) {
        if (!memory.get(country) && !BUNDLED_GEO[country] && !cancelled)
          setState({ status: 'error', message: 'Liste des villes indisponible pour ce pays.' });
        return;
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8_000);
        const res = await fetch(REMOTE.replace('{country}', country), { signal: controller.signal });
        clearTimeout(timer);
        const body: unknown = res.ok ? await res.json() : null;
        fetched.add(country);
        if (isValidDataset(body, country)) {
          adopt(body);
          await AsyncStorage.setItem(storageKey(country), JSON.stringify(body));
        }
      } catch {
        if (!memory.get(country) && !BUNDLED_GEO[country] && !cancelled)
          setState({ status: 'error', message: 'Pas de connexion : la liste des villes n’a pas pu être chargée.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [country, attempt]);

  const retry = useCallback(() => {
    fetched.delete(country);
    setState(initial(country));
    setAttempt((n) => n + 1);
  }, [country]);

  return { ...state, retry };
}
