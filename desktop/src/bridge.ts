import type { BridgeError, IAppAPI } from './interfaces/AppBridge';
import type { IElectronAPI } from './interfaces/IElectronBridge';

/** Erro serializado pelo preload: `code` é o AppErrorCode do core (VALIDATION, OFFLINE...). */
export interface SerializedBridgeError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export type BridgeEnvelope<T> = { ok: true; value: T } | { ok: false; error: SerializedBridgeError };

type RawApi = Record<string, (...args: unknown[]) => unknown>;

declare global {
  interface Window {
    __bridge?: { electron: RawApi; app: RawApi };
  }
}

function unwrap<T>(raw: RawApi): T {
  const api: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(raw)) {
    if (name.startsWith('on')) {
      api[name] = fn;
      continue;
    }
    api[name] = async (...args: unknown[]) => {
      const result = (await fn(...args)) as BridgeEnvelope<unknown>;
      if (result.ok) return result.value;
      const error = new Error(result.error.message) as BridgeError;
      error.code = result.error.code;
      error.details = result.error.details;
      throw error;
    };
  }
  return api as T;
}

/** Monta window.electronAPI e window.appAPI a partir dos envelopes expostos pelo preload. */
export function installBridge() {
  const raw = window.__bridge;
  if (!raw) throw new Error('Preload do Electron não carregado');
  window.electronAPI = unwrap<IElectronAPI>(raw.electron);
  window.appAPI = unwrap<IAppAPI>(raw.app);
}
