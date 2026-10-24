import type { DbSyncEvent } from '../../src/interfaces/IElectronBridge.js';

type Listener = (event: DbSyncEvent) => void;

const listeners = new Set<Listener>();

/** Registra um ouvinte para eventos de sincronização do banco (recarga, conflito, presença). */
export function onDbSyncEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDbSyncEvent(event: DbSyncEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[DB Sync] Erro em ouvinte de evento:', err);
    }
  }
}
