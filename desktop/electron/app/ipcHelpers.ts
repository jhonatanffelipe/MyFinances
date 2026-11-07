import { BrowserWindow, ipcMain } from 'electron';
import { AppError } from '@myfinances/core';

/** Prefixo que o preload reconhece para remontar o erro com `code` no renderer. */
export const APP_ERROR_PREFIX = 'APPERR:';

/** Serializa o erro para atravessar o IPC sem perder o código do AppError. */
export function toBridgeError(err: unknown): Error {
  if (err instanceof AppError) {
    return new Error(APP_ERROR_PREFIX + JSON.stringify({ code: err.code, message: err.message, details: err.details ?? null }));
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error('[ipc] erro inesperado:', err);
  return new Error(APP_ERROR_PREFIX + JSON.stringify({ code: 'UNEXPECTED', message }));
}

/** ipcMain.handle com tratamento de erro padronizado. */
export function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => Promise<R> | R) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...(args as A));
    } catch (err) {
      throw toBridgeError(err);
    }
  });
}

/** Envia um evento para todas as janelas abertas. */
export function broadcast(channel: string, payload?: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
