import { DbAdapter } from './adapter';

/**
 * Estrutura do banco — mesma do MyFinances desktop (electron/database/schema.ts).
 * As duas versões precisam ficar iguais, pois os apps compartilham o mesmo arquivo.
 */
async function ensureColumn(db: DbAdapter, table: string, column: string, definition: string) {
  try {
    const columns = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!columns.some((c) => c.name === column)) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (err) {
    console.error(`Erro ao garantir coluna ${table}.${column}:`, err);
  }
}

export async function createTablesAndRunMigrations(db: DbAdapter) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT,
      role TEXT,
      phone TEXT,
      avatar TEXT,
      last_login TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS credit_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      due_day INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      category_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'EXPENSE',
      category_id INTEGER,
      due_day INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      active INTEGER DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS fixed_expense_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixed_expense_id INTEGER NOT NULL,
      year_month TEXT NOT NULL,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(fixed_expense_id, year_month),
      FOREIGN KEY(fixed_expense_id) REFERENCES fixed_expenses(id) ON DELETE CASCADE
    )
  `);

  // Migrações incrementais (mesma ordem do desktop)
  await ensureColumn(db, 'categories', 'description', 'TEXT');
  await ensureColumn(db, 'categories', 'monthly_limit', 'REAL');
  await ensureColumn(db, 'movements', 'credit_card_id', 'INTEGER');
  await ensureColumn(db, 'movements', 'fixed_expense_id', 'INTEGER');
  await ensureColumn(db, 'fixed_expenses', 'credit_card_id', 'INTEGER');
  await ensureColumn(db, 'fixed_expenses', 'recurrence', "TEXT DEFAULT 'MONTHLY'");
  await ensureColumn(db, 'fixed_expenses', 'type', "TEXT NOT NULL DEFAULT 'EXPENSE'");

  await ensureColumn(db, 'users', 'email', 'TEXT');
  await ensureColumn(db, 'users', 'role', 'TEXT');
  await ensureColumn(db, 'users', 'phone', 'TEXT');
  await ensureColumn(db, 'users', 'avatar', 'TEXT');
  await ensureColumn(db, 'users', 'last_login', 'TEXT');
}
