import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Client Supabase de YA YO. Sans EXPO_PUBLIC_SUPABASE_URL et
 * EXPO_PUBLIC_SUPABASE_ANON_KEY, l'app reste en mode démo (supabase = null).
 * La clé « anon » est publique : ce sont les règles d'accès de la base
 * (supabase/migrations) qui protègent les données, pas la clé.
 * Aucun écran ne l'utilise encore.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isServerMode = (): boolean => supabase !== null;

// Sur téléphone, la session ne se renouvelle que lorsque l'app est au premier plan.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
