import initSqlJs, { type Database } from 'sql.js';
import { createSqlJsAdapter, type DbAdapter } from '../src/index';

/**
 * Bancos da v1 (db_myfinances.sqlite) para os testes da importação. O schema é o da v1
 * (desktop/electron/database/schema.ts antes da v2): `legacy` cria o banco ANTES das
 * colunas que a v1 acrescentou depois com `ensureColumn`.
 */
export async function createV1Database(options: { legacy?: boolean } = {}): Promise<{ db: Database; adapter: DbAdapter }> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const legacy = !!options.legacy;
  db.run(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE credit_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#8b5cf6',
          due_day INTEGER NOT NULL, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, color TEXT, icon TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP${legacy ? '' : ', description TEXT, monthly_limit REAL'})`);
  db.run(`CREATE TABLE movements (id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL,
          type TEXT NOT NULL, category_id INTEGER, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ${legacy ? '' : ', credit_card_id INTEGER, fixed_expense_id INTEGER'})`);
  db.run(`CREATE TABLE fixed_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL, amount REAL NOT NULL,
          category_id INTEGER, due_day INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT, active INTEGER DEFAULT 1, notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP${legacy ? '' : ", type TEXT NOT NULL DEFAULT 'EXPENSE', credit_card_id INTEGER, recurrence TEXT DEFAULT 'MONTHLY'"})`);
  db.run(`CREATE TABLE fixed_expense_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, fixed_expense_id INTEGER NOT NULL, year_month TEXT NOT NULL,
          paid_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(fixed_expense_id, year_month))`);

  db.run("INSERT INTO users (name, password_hash, created_at) VALUES ('Jhonatan', 'salt:hash', '2025-01-02 10:00:00')");
  // Mesmos nomes das categorias padrão da v2 (reaproveitadas) + uma só da v1
  for (const [name, type] of [['Moradia', 'EXPENSE'], ['Alimentação', 'EXPENSE'], ['Salário', 'INCOME'], ['Pets', 'EXPENSE']]) {
    db.run("INSERT INTO categories (name, type, color, icon, created_at) VALUES (?, ?, '#10b981', 'Tag', '2025-01-02 10:00:00')", [name, type]);
  }
  return { db, adapter: createSqlJsAdapter(db) };
}

/** Lançamentos de 3 meses, com cartão, fixo gerado e baixa (só no banco atual). */
export function seedV1(db: Database, options: { legacy?: boolean } = {}) {
  const legacy = !!options.legacy;
  const mov = (description: string, amount: number, date: string, type: string, category: number | null, card: number | null = null, fixed: number | null = null) =>
    legacy
      ? db.run('INSERT INTO movements (description, amount, date, type, category_id) VALUES (?, ?, ?, ?, ?)', [description, amount, date, type, category])
      : db.run('INSERT INTO movements (description, amount, date, type, category_id, credit_card_id, fixed_expense_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [
          description, amount, date, type, category, card, fixed,
        ]);

  db.run("INSERT INTO credit_cards (description, color, due_day) VALUES ('Nubank', '#8b5cf6', 8)");
  if (legacy) {
    db.run("INSERT INTO fixed_expenses (description, amount, category_id, due_day, start_date, end_date) VALUES ('Aluguel', 1500, 1, 5, '2025-08-01', '2025-10-31')");
  } else {
    db.run("INSERT INTO fixed_expenses (description, amount, category_id, due_day, start_date, end_date, type, credit_card_id, recurrence) VALUES ('Aluguel', 1500, 1, 5, '2025-08-01', '2025-10-31', '', NULL, 'MONTHLY')");
    db.run("INSERT INTO fixed_expenses (description, amount, category_id, due_day, start_date, end_date, type, recurrence) VALUES ('Salário', 5000, 3, 5, '2025-08-01', NULL, 'INCOME', 'MONTHLY')");
  }
  for (const month of ['2025-08', '2025-09', '2025-10']) {
    mov('Aluguel', 1500, `${month}-05`, 'EXPENSE', 1, null, 1);
    mov('Salário', 5000, `${month}-05`, 'INCOME', 3, null, legacy ? null : 2);
    mov('Mercado', 412.37, `${month}-12`, 'EXPENSE', 2, 1);
    mov('Ração', 89.9, `${month}-20`, 'EXPENSE', 4, 1);
  }
  db.run("INSERT INTO fixed_expense_payments (fixed_expense_id, year_month) VALUES (1, '2025-08'), (1, '2025-09')");
}

/** Totais por mês exatamente como a v1 calculava (soma por tipo em `movements`). */
export function v1MonthTotals(db: Database, yearMonth: string) {
  const r = db.exec(
    `SELECT COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0), COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0)
     FROM movements WHERE substr(date, 1, 7) = '${yearMonth}'`,
  )[0].values[0];
  return { income: Math.round(Number(r[0]) * 100) / 100, expense: Math.round(Number(r[1]) * 100) / 100 };
}
