import { DbAdapter } from './adapter';

/**
 * Conexão ativa com o banco e notificação de alterações.
 * Toda escrita passa por `mutate`, que dispara os ouvintes (a sincronização
 * com o OneDrive usa isso para enviar o arquivo atualizado).
 */
let current: DbAdapter | null = null;
const listeners = new Set<() => void>();

export function setDatabase(adapter: DbAdapter | null) {
  current = adapter;
}

export function hasDatabase() {
  return current !== null;
}

export function getDb(): DbAdapter {
  if (!current) throw new Error('Banco de dados não está aberto');
  return current;
}

/** Assina alterações gravadas no banco. Retorna a função para cancelar. */
export function onDataChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Executa uma escrita em transação e avisa os ouvintes ao final. */
export async function mutate<T>(fn: (tx: DbAdapter) => Promise<T>): Promise<T> {
  const result = await getDb().transaction(fn);
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error('[DB] Erro em ouvinte de alteração:', err);
    }
  }
  return result;
}
