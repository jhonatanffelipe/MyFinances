import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTablesAndRunMigrations } from './schema.js';
import { seedInitialCategories } from './seed.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_FILE_NAME = 'db_myfinances.sqlite';
export const LEGACY_DB_FILE_NAME = 'database.sqlite';

let dbInstance: any = null;
let currentDbFilePath: string | null = null;

export function getDatabase() {
  return dbInstance;
}

export function getCurrentDbFilePath() {
  return currentDbFilePath;
}

export function persistDatabaseToDisk() {
  if (dbInstance && currentDbFilePath) {
    try {
      const binaryArray = dbInstance.export();
      const buffer = Buffer.from(binaryArray);
      fs.writeFileSync(currentDbFilePath, buffer);
    } catch (err) {
      console.error('Error saving SQLite database to disk:', err);
    }
  }
}

export function queryObjects(sql: string, params: any[] = []): any[] {
  if (!dbInstance) return [];
  try {
    const stmt = dbInstance.prepare(sql);
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

    if (dbInstance) {
      try { dbInstance.close(); } catch (_) {}
      dbInstance = null;
    }

    // Carrega o sql.js com WebAssembly
    const { initSqlJs, wasmPath } = resolveSqlJs();

    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });

    if (fs.existsSync(currentDbFilePath)) {
      const fileBuffer = fs.readFileSync(currentDbFilePath);
      dbInstance = new SQL.Database(fileBuffer);
    } else {
      dbInstance = new SQL.Database();
    }

    // Tabelas e migrações
    createTablesAndRunMigrations(dbInstance, queryObjects);

    // Seed se necessário
    seedInitialCategories(dbInstance, queryObject);

    persistDatabaseToDisk();
    console.log('[DB] Database initialized successfully at:', currentDbFilePath);
    return true;
  } catch (err) {
    console.error('[DB] Erro ao inicializar o banco de dados SQLite:', err);
    return false;
  }
}

export function closeDatabase() {
  if (dbInstance) {
    persistDatabaseToDisk();
    try { dbInstance.close(); } catch (_) {}
    dbInstance = null;
  }
}
