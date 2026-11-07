import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Tokens, TokenStore } from './tokens';

const KEY = 'yayo.tokens';

/** Keychain / Keystore on the phone; the browser has no secure store, so the web build uses local storage. */
export const deviceTokenStore: TokenStore = {
  async get() {
    const raw = Platform.OS === 'web' ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      const t = JSON.parse(raw) as Tokens;
      return typeof t.accessToken === 'string' ? t : null;
    } catch {
      return null;
    }
  },
  async set(tokens) {
    if (Platform.OS === 'web') {
      if (tokens) await AsyncStorage.setItem(KEY, JSON.stringify(tokens));
      else await AsyncStorage.removeItem(KEY);
      return;
    }
    if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(KEY);
  },
};
