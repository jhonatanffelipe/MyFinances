import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { KeyValueStore } from '@myfinances/core';

/**
 * KeyValueStore do desktop (processo main): um JSON em userData com cada valor cifrado
 * pelo safeStorage do Electron (Keychain no macOS, DPAPI no Windows, libsecret no Linux).
 * Guarda a conexão com o Supabase e a sessão (refresh token) do supabase-js.
 *
 * A gravação é atômica (arquivo temporário + rename): uma queda no meio não corrompe
 * o arquivo nem perde a sessão anterior.
 */
export class SafeStorageKeyValueStore implements KeyValueStore {
  private cache: Record<string, string> | null = null;

  constructor(private readonly filePath = path.join(app.getPath('userData'), 'secure-store.json')) {}

  private ensureAvailable() {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Criptografia do sistema indisponível: não é seguro guardar a sessão neste computador');
    }
  }

  private read(): Record<string, string> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Record<string, string>;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private write(data: Record<string, string>) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
    this.cache = data;
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = this.read()[key];
    if (!encrypted) return null;
    this.ensureAvailable();
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      return null; // cifrado em outro usuário/máquina: trata como ausente
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    this.ensureAvailable();
    const data = { ...this.read(), [key]: safeStorage.encryptString(value).toString('base64') };
    this.write(data);
  }

  async removeItem(key: string): Promise<void> {
    const data = { ...this.read() };
    if (!(key in data)) return;
    delete data[key];
    this.write(data);
  }
}
