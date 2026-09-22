export function ensureColumn(
  db: any,
  queryObjectsFn: (sql: string, params?: any[]) => any[],
  table: string,
  column: string,
  definition: string
) {
  try {
    const columns = queryObjectsFn(`PRAGMA table_info(${table})`);
    if (!columns.some((c) => c.name === column)) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`[DB] Coluna ${table}.${column} criada.`);
    }
  } catch (err) {
    console.error(`Erro ao garantir coluna ${table}.${column}:`, err);
  }
}

export function createTablesAndRunMigrations(
  db: any,
  queryObjectsFn: (sql: string, params?: any[]) => any[]
) {
  // ---- Tabelas (um statement por run, exigência do sql.js) ----
  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS credit_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      due_day INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
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

  db.run(`
    CREATE TABLE IF NOT EXISTS fixed_expense_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixed_expense_id INTEGER NOT NULL,
      year_month TEXT NOT NULL,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(fixed_expense_id, year_month),
      FOREIGN KEY(fixed_expense_id) REFERENCES fixed_expenses(id) ON DELETE CASCADE
    )
  `);

  // ---- Migrações incrementais para bancos já existentes ----
  ensureColumn(db, queryObjectsFn, 'categories', 'description', 'TEXT');
  ensureColumn(db, queryObjectsFn, 'categories', 'monthly_limit', 'REAL');
  ensureColumn(db, queryObjectsFn, 'movements', 'credit_card_id', 'INTEGER');
  ensureColumn(db, queryObjectsFn, 'movements', 'fixed_expense_id', 'INTEGER');
  ensureColumn(db, queryObjectsFn, 'fixed_expenses', 'credit_card_id', 'INTEGER');
  ensureColumn(db, queryObjectsFn, 'fixed_expenses', 'recurrence', "TEXT DEFAULT 'MONTHLY'");

  // ---- Campos de Perfil de Usuário ----
  ensureColumn(db, queryObjectsFn, 'users', 'email', 'TEXT');
  ensureColumn(db, queryObjectsFn, 'users', 'role', 'TEXT');
  ensureColumn(db, queryObjectsFn, 'users', 'phone', 'TEXT');
  ensureColumn(db, queryObjectsFn, 'users', 'avatar', 'TEXT');
  ensureColumn(db, queryObjectsFn, 'users', 'last_login', 'TEXT');
}
