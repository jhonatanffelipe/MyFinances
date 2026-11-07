import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { AppError, createExpoSqliteAdapter, type DbAdapter } from '@myfinances/core';

/**
 * Banco da v1 escolhido no celular: o arquivo é lido e aberto como CÓPIA em memória
 * (o original nunca é alterado nem copiado para a pasta do app).
 */
let current: { db: SQLiteDatabase; adapter: DbAdapter; fileName: string } | null = null;

export async function pickV1File(): Promise<{ fileName: string; adapter: DbAdapter } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  await closeV1File();
  let db: SQLiteDatabase;
  try {
    const bytes = new Uint8Array(await new File(asset.uri).arrayBuffer());
    db = await deserializeDatabaseAsync(bytes);
  } catch {
    throw AppError.validation('Não foi possível abrir o arquivo. Escolha o db_myfinances.sqlite da v1.');
  }
  current = { db, adapter: createExpoSqliteAdapter(db), fileName: asset.name };
  return { fileName: asset.name, adapter: current.adapter };
}

export function currentV1File() {
  return current;
}

export async function closeV1File() {
  const open = current;
  current = null;
  await open?.db.closeAsync().catch(() => undefined);
}
