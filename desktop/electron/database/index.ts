import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTablesAndRunMigrations } from './schema.js';
import { seedInitialCategories } from './seed.js';
import { startDbLock, stopDbLock } from './lock.js';
import { emitDbSyncEvent } from './syncEvents.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_FILE_NAME = 'db_myfinances.sqlite';
export const LEGACY_DB_FILE_NAME = 'database.sqlite';

let dbInstance: any = null;
let currentDbFilePath: string | null = null;
let SQL: any = null;

/**
 * Hash (SHA-256) do conteúdo do arquivo na última vez em que este app o leu ou gravou.
 * Se o arquivo no disco tiver outro hash, ele foi alterado por fora (OneDrive trouxe
 * uma versão de outro dispositivo) e não pode ser sobrescrito às cegas.
 */
let lastSyncedHash: string | null = null;
let watchedFilePath: string | null = null;
let checkingExternal = false;

/** Intervalo de verificação do arquivo pelo watcher (polling é mais confiável com OneDrive). */
const WATCH_INTERVAL_MS = 2000;

export type PersistResult = 'saved' | 'unchanged' | 'conflict' | 'skipped' | 'error';

export function getDatabase() {
  return dbInstance;
}

export function getCurrentDbFilePath() {
  return currentDbFilePath;
}

function hashBuffer(buffer: Uint8Array): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Lê o arquivo atual do banco no disco. Retorna null se ele não existir. */
function readDiskSnapshot(): { buffer: Buffer; hash: string } | null {
  if (!currentDbFilePath || !fs.existsSync(currentDbFilePath)) return null;
  const buffer = fs.readFileSync(currentDbFilePath);
  return { buffer, hash: hashBuffer(buffer) };
}

/**
 * Abre um buffer como banco e confere a integridade. Protege contra arquivos
 * vazios ou incompletos enquanto o OneDrive ainda está baixando a nova versão.
 */
function openValidatedDatabase(buffer: Buffer): any | null {
  if (!SQL || buffer.length === 0) return null;
  let db: any = null;
  try {
    db = new SQL.Database(buffer);
    const result = db.exec('PRAGMA quick_check');
    const status = result?.[0]?.values?.[0]?.[0];
    if (status !== 'ok') {
      db.close();
      return null;
    }
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'movements'");
    if (!tables?.[0]?.values?.length) {
      db.close();
      return null;
    }
    return db;
  } catch {
    try { db?.close(); } catch (_) {}
    return null;
  }
}

/** Garante tabelas, migrações e seed em uma instância recém-aberta. */
function prepareDatabase(db: any) {
  createTablesAndRunMigrations(db, (sql, params = []) => runQuery(db, sql, params));
  seedInitialCategories(db, (sql: string, params: any[] = []) => runQuery(db, sql, params)[0] ?? null);
}

/** Substitui o banco em memória pela versão lida do disco. */
function replaceInstanceFromBuffer(buffer: Buffer, hash: string): boolean {
  const next = openValidatedDatabase(buffer);
  if (!next) return false;
  if (dbInstance) {
    try { dbInstance.close(); } catch (_) {}
  }
  dbInstance = next;
  lastSyncedHash = hash;
  prepareDatabase(dbInstance);
  // Grava somente se as migrações tiverem alterado algo (o hash evita escrita desnecessária)
  persistDatabaseToDisk();
  return true;
}

/** Salva a versão em memória (que não pôde ser gravada) ao lado do banco, para recuperação manual. */
function saveConflictCopy(buffer: Buffer): string | null {
  if (!currentDbFilePath) return null;
  try {
    const dir = path.dirname(currentDbFilePath);
    const ext = path.extname(currentDbFilePath);
    const base = path.basename(currentDbFilePath, ext);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const host = os.hostname().replace(/[^\w-]/g, '_');
    const copyPath = path.join(dir, `${base}.conflito-${host}-${stamp}${ext}`);
    fs.writeFileSync(copyPath, buffer);
    return copyPath;
  } catch (err) {
    console.error('[DB Sync] Falha ao salvar cópia de conflito:', err);
    return null;
  }
}

/**
 * Grava o banco em memória no disco, sem sobrescrever alterações feitas por outro
 * dispositivo. Se o arquivo mudou desde a última leitura/gravação, a versão local é
 * salva como cópia de conflito, a versão do disco é carregada e a interface é avisada.
 */
export function persistDatabaseToDisk(): PersistResult {
  if (!dbInstance || !currentDbFilePath) return 'skipped';
  try {
    const data = Buffer.from(dbInstance.export());
    const newHash = hashBuffer(data);
    const disk = readDiskSnapshot();

    if (disk && disk.hash !== lastSyncedHash) {
      if (disk.hash === newHash) {
        lastSyncedHash = newHash;
        return 'unchanged';
      }

      console.warn('[DB Sync] Arquivo alterado por outro dispositivo; gravação local cancelada.');
      const conflictCopyPath = saveConflictCopy(data);
      const reloaded = replaceInstanceFromBuffer(disk.buffer, disk.hash);
      emitDbSyncEvent({ type: 'conflict', conflictCopyPath, reloaded });
      return 'conflict';
    }

    if (disk && disk.hash === newHash) {
      lastSyncedHash = newHash;
      return 'unchanged';
    }

    // Atualiza o hash antes de gravar para o watcher não tratar a própria escrita como externa
    lastSyncedHash = newHash;
    fs.writeFileSync(currentDbFilePath, data);
    return 'saved';
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
    return 'error';
  }
}

/**
 * Verifica se o arquivo foi alterado por fora e, se sim, recarrega o banco em memória.
 * Retorna true quando houve recarga.
 */
export function checkForExternalChanges(): boolean {
  if (!dbInstance || !currentDbFilePath || checkingExternal) return false;
  checkingExternal = true;
  try {
    const disk = readDiskSnapshot();
    if (!disk || disk.hash === lastSyncedHash) return false;

    const reloaded = replaceInstanceFromBuffer(disk.buffer, disk.hash);
    if (reloaded) {
      console.log('[DB Sync] Banco recarregado a partir de alteração externa.');
      emitDbSyncEvent({ type: 'reloaded' });
    }
    // Se não recarregou (arquivo incompleto), tenta de novo na próxima verificação
    return reloaded;
  } catch (err) {
    console.error('[DB Sync] Erro ao verificar alterações externas:', err);
    return false;
  } finally {
    checkingExternal = false;
  }
}

function startWatching(filePath: string) {
  stopWatching();
  watchedFilePath = filePath;
  fs.watchFile(filePath, { interval: WATCH_INTERVAL_MS, persistent: false }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs || curr.size !== prev.size) {
      checkForExternalChanges();
    }
  });
}

function stopWatching() {
  if (watchedFilePath) {
    fs.unwatchFile(watchedFilePath);
    watchedFilePath = null;
  }
}

function runQuery(db: any, sql: string, params: any[] = []): any[] {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('Query error:', sql, err);
    return [];
  }
}

export function queryObjects(sql: string, params: any[] = []): any[] {
  return runQuery(dbInstance, sql, params);
}

export function queryObject(sql: string, params: any[] = []): any | null {
  const rows = queryObjects(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function resolveSqlJs(): { initSqlJs: any; wasmPath: string } {
  // 1. Tenta resolver via require.resolve padrão do Node/Electron
  try {
    const jsEntry = require.resolve('sql.js');
    const wasmPath = path.join(path.dirname(jsEntry), 'sql-wasm.wasm');
    if (fs.existsSync(wasmPath)) {
      return { initSqlJs: require(jsEntry), wasmPath };
    }
  } catch (_) {}

  // 2. Procura em diretórios candidatos conhecidos (desenvolvimento, empacotado e dist-electron)
  const candidateDirs: string[] = [
    path.join(__dirname, '..', 'node_modules', 'sql.js'),
    path.join(__dirname, '..', '..', 'node_modules', 'sql.js'),
    path.join(process.cwd(), 'node_modules', 'sql.js'),
  ];

  try {
    const electron = require('electron');
    if (electron?.app?.getAppPath) {
      candidateDirs.push(path.join(electron.app.getAppPath(), 'node_modules', 'sql.js'));
    }
  } catch (_) {}

  if ((process as any).resourcesPath) {
    candidateDirs.push(path.join((process as any).resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js'));
    candidateDirs.push(path.join((process as any).resourcesPath, 'node_modules', 'sql.js'));
  }

  for (const dir of candidateDirs) {
    const jsEntry = path.join(dir, 'dist', 'sql-wasm.js');
    const wasmPath = path.join(dir, 'dist', 'sql-wasm.wasm');
    if (fs.existsSync(jsEntry) && fs.existsSync(wasmPath)) {
      return { initSqlJs: require(jsEntry), wasmPath };
    }
  }

  throw new Error('Não foi possível localizar os arquivos do sql.js (sql-wasm.js e sql-wasm.wasm)');
}

export async function initDatabase(targetPath: string): Promise<boolean> {
  try {
    const isFile = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile();

    if (isFile) {
      currentDbFilePath = targetPath;
    } else {
      const folderPath = targetPath;
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const legacyPath = path.join(folderPath, LEGACY_DB_FILE_NAME);
      currentDbFilePath = fs.existsSync(legacyPath)
        ? legacyPath
        : path.join(folderPath, DB_FILE_NAME);
    }

    stopWatching();
    stopDbLock();
    if (dbInstance) {
      try { dbInstance.close(); } catch (_) {}
      dbInstance = null;
    }
    lastSyncedHash = null;

    // Carrega o sql.js com WebAssembly (uma única vez)
    if (!SQL) {
      const { initSqlJs, wasmPath } = resolveSqlJs();
      SQL = await initSqlJs({
        locateFile: () => wasmPath,
      });
    }

    const disk = readDiskSnapshot();
    if (disk) {
      dbInstance = new SQL.Database(disk.buffer);
      lastSyncedHash = disk.hash;
    } else {
      dbInstance = new SQL.Database();
    }

    // Tabelas, migrações e seed se necessário
    prepareDatabase(dbInstance);

    persistDatabaseToDisk();
    startWatching(currentDbFilePath);
    startDbLock(currentDbFilePath);
    console.log('[DB] Database initialized successfully at:', currentDbFilePath);
    return true;
  } catch (err) {
    console.error('[DB] Erro ao inicializar o banco de dados SQLite:', err);
    return false;
  }
}

export function closeDatabase() {
  stopWatching();
  if (dbInstance) {
    persistDatabaseToDisk();
    try { dbInstance.close(); } catch (_) {}
    dbInstance = null;
  }
  stopDbLock();
  lastSyncedHash = null;
}
