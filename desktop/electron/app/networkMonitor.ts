import { net } from 'electron';
import type { NetworkMonitor } from '@myfinances/core';

/**
 * Estado da rede no processo main. O `net.isOnline()` do Electron só sabe se há
 * interface de rede ativa; falhas reais de acesso ao Supabase são tratadas pelo
 * SyncEngine (backoff). Verifica a cada 10 s e avisa quando muda.
 */
export class ElectronNetworkMonitor implements NetworkMonitor {
  private online = net.isOnline();
  private readonly listeners = new Set<(online: boolean) => void>();
  private readonly timer: NodeJS.Timeout;

  constructor(intervalMs = 10_000) {
    this.timer = setInterval(() => {
      const now = net.isOnline();
      if (now === this.online) return;
      this.online = now;
      this.listeners.forEach((l) => l(now));
    }, intervalMs);
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
    clearInterval(this.timer);
    this.listeners.clear();
  }
}
