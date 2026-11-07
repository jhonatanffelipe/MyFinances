import { openDatabaseAsync } from 'expo-sqlite';
import { createExpoSqliteAdapter, type LocalDatabaseHandle } from '@myfinances/core';

/**
 * SQLite local do celular: um arquivo por projeto + usuário, na pasta interna do app
 * (o usuário não escolhe pasta). WAL deixa as leituras rodarem durante o sync.
 */
export async function openLocalDatabase(fileName: string): Promise<LocalDatabaseHandle> {
  const db = await openDatabaseAsync(fileName);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return {
    adapter: createExpoSqliteAdapter(db),
    close: () => db.closeAsync(),
  };
}
