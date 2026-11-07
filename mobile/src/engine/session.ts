import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { createClient } from '@supabase/supabase-js';
import { AppSession, SUPABASE_AUTH_STORAGE_KEY, type AppSupabaseClient, type FetchLike } from '@myfinances/core';
import { mobileSecureStore } from '../connection/secureStore';
import { openLocalDatabase } from './database';
import { NetInfoNetworkMonitor } from './network';

/** "Moto G (Android)": aparece no pedido de aprovação e em Aparelhos conectados. */
export function deviceName() {
  const model = Device.modelName || Device.deviceName || 'Celular';
  const os = Platform.OS === 'ios' ? 'iOS' : 'Android';
  return `${model} (${os})`.slice(0, 60);
}

export const network = new NetInfoNetworkMonitor();

/**
 * Sessão única do app (conexão, conta, banco local, sync e Realtime). Tudo roda no
 * mesmo processo JS; as telas leem o estado pelo AppStateContext e os dados pelo
 * `appSession.core()`.
 */
export const appSession = new AppSession({
  secure: mobileSecureStore,
  network,
  fetch: fetch as unknown as FetchLike,
  createClient: (connection) =>
    createClient(connection.url, connection.key, {
      auth: {
        storage: mobileSecureStore,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        persistSession: true,
        // A renovação acompanha o AppState (startAutoRefresh/stopAutoRefresh)
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }) as unknown as AppSupabaseClient,
  openDatabase: openLocalDatabase,
  device: { name: deviceName, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
  newId: () => Crypto.randomUUID(),
  log: (message, err) => console.warn(message, err),
});
