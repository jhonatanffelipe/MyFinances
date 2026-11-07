import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { NetworkMonitor } from '@myfinances/core';

const isOnline = (s: NetInfoState) => s.isConnected !== false && s.isInternetReachable !== false;

/**
 * Online/offline para o SyncEngine via NetInfo. Falhas reais de acesso ao Supabase
 * (servidor fora, projeto pausado) continuam sendo tratadas pelo backoff do SyncEngine.
 */
export class NetInfoNetworkMonitor implements NetworkMonitor {
  private online = true;
  private readonly listeners = new Set<(online: boolean) => void>();
  private readonly unsubscribe: () => void;

  constructor() {
    this.unsubscribe = NetInfo.addEventListener((state) => {
      const next = isOnline(state);
      if (next === this.online) return;
      this.online = next;
      this.listeners.forEach((l) => l(next));
    });
    NetInfo.fetch()
      .then((state) => {
        this.online = isOnline(state);
      })
      .catch(() => undefined);
  }

  isOnline() {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose() {
    this.unsubscribe();
    this.listeners.clear();
  }
}
