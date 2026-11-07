import { normalizeProjectUrl, projectRef, validateConnection, type SupabaseConnection } from './connection';

/**
 * Armazenamento chave/valor assíncrono. É o mesmo formato do `storage` do supabase-js,
 * então a mesma implementação guarda a conexão e a sessão (refresh token).
 * Desktop: arquivo cifrado com safeStorage; mobile: expo-secure-store.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Em memória (testes e sessão temporária). */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
  keys() {
    return [...this.data.keys()];
  }
}

/**
 * Divide valores grandes em pedaços. O expo-secure-store recusa valores acima de ~2 KB,
 * e a sessão do Supabase (JWT + refresh token) costuma passar disso.
 * Também troca caracteres que o SecureStore não aceita na chave.
 */
export class ChunkedKeyValueStore implements KeyValueStore {
  constructor(private readonly inner: KeyValueStore, private readonly maxChunk = 1800) {}

  private safe(key: string) {
    return key.replace(/[^A-Za-z0-9._-]/g, '_');
  }

  async getItem(key: string): Promise<string | null> {
    const k = this.safe(key);
    const count = Number(await this.inner.getItem(`${k}.n`));
    if (!count) return this.inner.getItem(k);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await this.inner.getItem(`${k}.${i}`);
      if (part === null) return null; // gravação incompleta: trata como ausente
      parts.push(part);
    }
    return parts.join('');
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    const k = this.safe(key);
    if (value.length <= this.maxChunk) {
      await this.inner.setItem(k, value);
      return;
    }
    const count = Math.ceil(value.length / this.maxChunk);
    for (let i = 0; i < count; i++) await this.inner.setItem(`${k}.${i}`, value.slice(i * this.maxChunk, (i + 1) * this.maxChunk));
    await this.inner.setItem(`${k}.n`, String(count)); // por último: só vale quando tudo foi gravado
  }

  async removeItem(key: string): Promise<void> {
    const k = this.safe(key);
    const count = Number(await this.inner.getItem(`${k}.n`));
    await this.inner.removeItem(`${k}.n`);
    for (let i = 0; i < count; i++) await this.inner.removeItem(`${k}.${i}`);
    await this.inner.removeItem(k);
  }
}

export interface SavedConnection extends SupabaseConnection {
  projectRef: string;
  savedAt: string;
}

const CONNECTION_KEY = 'myfinances.connection';

/** Conexão salva com o projeto Supabase do usuário (URL + publishable key). */
export class ConnectionRepository {
  constructor(private readonly store: KeyValueStore) {}

  async load(): Promise<SavedConnection | null> {
    const raw = await this.store.getItem(CONNECTION_KEY);
    if (!raw) return null;
    try {
      const saved = JSON.parse(raw) as SavedConnection;
      return { ...saved, ...validateConnection(saved) };
    } catch {
      // conteúdo inválido (ou chave secreta gravada por versão antiga): esquece
      await this.store.removeItem(CONNECTION_KEY);
      return null;
    }
  }

  async save(connection: SupabaseConnection, savedAt: string): Promise<SavedConnection> {
    const valid = validateConnection(connection);
    const saved: SavedConnection = { ...valid, projectRef: projectRef(valid.url), savedAt };
    await this.store.setItem(CONNECTION_KEY, JSON.stringify(saved));
    return saved;
  }

  clear(): Promise<void> {
    return this.store.removeItem(CONNECTION_KEY);
  }
}

/**
 * Nome do arquivo SQLite local: um por projeto Supabase + usuário, para trocar de
 * conexão ou de conta sem misturar dados.
 */
export function localDatabaseName(url: string, userId: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9-]/g, '');
  return `${projectRef(normalizeProjectUrl(url))}-${safeUser}.sqlite`;
}
