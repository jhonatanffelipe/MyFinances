import { app } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DbDevicePresence } from '../../src/interfaces/IElectronBridge.js';
import { emitDbSyncEvent } from './syncEvents.js';

/**
 * Arquivo de presença (<banco>.lock) salvo ao lado do banco, na pasta sincronizada.
 * Não bloqueia o uso: serve para avisar quando o mesmo banco está aberto em outro
 * dispositivo (outro computador ou, futuramente, o app mobile).
 */

/** Intervalo de atualização do arquivo de presença. */
const HEARTBEAT_MS = 60 * 1000;
/** Após esse tempo sem atualização, a presença de outro dispositivo é considerada encerrada. */
const STALE_MS = 3 * 60 * 1000;

let lockFilePath: string | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let otherDevice: DbDevicePresence | null = null;
let cachedDeviceId: string | null = null;

/** Identificador estável deste computador (gravado em userData, fora da pasta sincronizada). */
function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  const idFile = path.join(app.getPath('userData'), 'device-id');
  try {
    if (fs.existsSync(idFile)) {
      const saved = fs.readFileSync(idFile, 'utf-8').trim();
      if (saved) {
        cachedDeviceId = saved;
        return saved;
      }
    }
    const created = crypto.randomUUID();
    fs.writeFileSync(idFile, created, 'utf-8');
    cachedDeviceId = created;
  } catch (err) {
    console.error('[DB Lock] Falha ao obter identificador do dispositivo:', err);
    cachedDeviceId = `${os.hostname()}-${process.pid}`;
  }
  return cachedDeviceId;
}

function readLock(): DbDevicePresence | null {
  if (!lockFilePath || !fs.existsSync(lockFilePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
    return parsed && parsed.deviceId ? (parsed as DbDevicePresence) : null;
  } catch {
    // Arquivo vazio/parcial (ex.: ainda sincronizando) é tratado como ausente
    return null;
  }
}

function isFresh(lock: DbDevicePresence): boolean {
  const updated = Date.parse(lock.updatedAt);
  return Number.isFinite(updated) && Date.now() - updated < STALE_MS;
}

function setOtherDevice(next: DbDevicePresence | null) {
  const changed =
    (otherDevice?.deviceId ?? null) !== (next?.deviceId ?? null) ||
    (next !== null && otherDevice?.updatedAt !== next.updatedAt);
  otherDevice = next;
  if (changed) {
    emitDbSyncEvent({ type: 'presence', otherDevice: next });
  }
}

/** Atualiza a presença deste dispositivo, respeitando a de outro dispositivo ainda ativo. */
function refreshLock() {
  if (!lockFilePath) return;
  const myId = getDeviceId();
  const current = readLock();

  if (current && current.deviceId !== myId && isFresh(current)) {
    setOtherDevice(current);
    return;
  }

  setOtherDevice(null);
  const mine: DbDevicePresence = {
    deviceId: myId,
    deviceName: os.hostname(),
    platform: process.platform,
    app: 'desktop',
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(lockFilePath, JSON.stringify(mine, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB Lock] Falha ao gravar arquivo de presença:', err);
  }
}

export function startDbLock(dbFilePath: string) {
  stopDbLock();
  lockFilePath = `${dbFilePath}.lock`;
  refreshLock();
  heartbeatTimer = setInterval(refreshLock, HEARTBEAT_MS);
}

/** Remove a presença deste dispositivo (somente se o arquivo for nosso). */
export function stopDbLock() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (lockFilePath) {
    const current = readLock();
    if (current && current.deviceId === getDeviceId()) {
      try {
        fs.unlinkSync(lockFilePath);
      } catch (_) {}
    }
  }
  lockFilePath = null;
  otherDevice = null;
}

/** Reavalia a presença imediatamente (ex.: ao focar a janela). */
export function checkDbLockNow() {
  refreshLock();
}

export function getOtherDevicePresence(): DbDevicePresence | null {
  return otherDevice;
}
