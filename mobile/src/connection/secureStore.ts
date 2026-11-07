import * as SecureStore from 'expo-secure-store';
import { ChunkedKeyValueStore, type KeyValueStore } from '@myfinances/core';

/** expo-secure-store (Keystore no Android, Keychain no iOS) como KeyValueStore. */
const secureStore: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

/**
 * Store seguro do mobile para a conexão e a sessão do Supabase. Valores acima de ~2 KB
 * (a sessão costuma passar) são divididos em pedaços pelo ChunkedKeyValueStore.
 */
export const mobileSecureStore: KeyValueStore = new ChunkedKeyValueStore(secureStore);
