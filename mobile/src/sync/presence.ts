import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { deleteInFolder, putFileInFolder, readTextInFolder } from './graph';
import { LOCK_STALE_MS } from './config';

/**
 * Arquivo de presença "<banco>.lock" na mesma pasta do OneDrive — mesmo formato
 * usado pelo desktop. Serve para avisar que o banco está aberto em outro aparelho.
 */
export interface DevicePresence {
  deviceId: string;
  deviceName: string;
  platform: string;
  app: 'desktop' | 'mobile';
  updatedAt: string;
}

const DEVICE_ID_KEY = 'myfinances.deviceId';
let deviceId: string | null = null;

async function getDeviceId() {
  if (deviceId) return deviceId;
  deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function isFresh(lock: DevicePresence) {
  const t = Date.parse(lock.updatedAt);
  return Number.isFinite(t) && Date.now() - t < LOCK_STALE_MS;
}

async function readLock(parentId: string, lockName: string): Promise<DevicePresence | null> {
  const text = await readTextInFolder(parentId, lockName);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed?.deviceId ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Atualiza a presença deste aparelho. Se outro dispositivo estiver ativo, não
 * sobrescreve e retorna esse dispositivo; caso contrário grava a nossa e retorna null.
 */
export async function refreshPresence(parentId: string, dbFileName: string): Promise<DevicePresence | null> {
  const lockName = `${dbFileName}.lock`;
  const myId = await getDeviceId();
  const current = await readLock(parentId, lockName);
  if (current && current.deviceId !== myId && isFresh(current)) {
    return current;
  }
  const mine: DevicePresence = {
    deviceId: myId,
    deviceName: Device.deviceName || Device.modelName || 'Celular',
    platform: Device.osName || 'android',
    app: 'mobile',
    updatedAt: new Date().toISOString(),
  };
  await putFileInFolder(parentId, lockName, JSON.stringify(mine, null, 2), 'application/json');
  return null;
}

/** Remove a presença deste aparelho (somente se o arquivo for nosso). */
export async function releasePresence(parentId: string, dbFileName: string) {
  const lockName = `${dbFileName}.lock`;
  const current = await readLock(parentId, lockName);
  if (current && current.deviceId === (await getDeviceId())) {
    await deleteInFolder(parentId, lockName);
  }
}
