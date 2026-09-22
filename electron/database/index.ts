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

export async function initDatabase(folderPath: string): Promise<boolean> {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const legacyPath = path.join(folderPath, LEGACY_DB_FILE_NAME);
    currentDbFilePath = fs.existsSync(legacyPath)
      ? legacyPath
      : path.join(folderPath, DB_FILE_NAME);

    if (dbInstance) {
      try { dbInstance.close(); } catch (_) {}
      dbInstance = null;
    }

    // Carrega o sql.js com WebAssembly a partir de node_modules
    const sqlJsPath = path.join(__dirname, '..', '..', 'node_modules', 'sql.js');
    const wasmPath = path.join(sqlJsPath, 'dist', 'sql-wasm.wasm');
    const initSqlJs = require(path.join(sqlJsPath, 'dist', 'sql-wasm.js'));

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
    console.error('Error initializing SQLite database:', err);
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
