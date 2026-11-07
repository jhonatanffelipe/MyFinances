import type { DbAdapter } from './adapter';

/**
 * Schema do SQLite LOCAL (cópia offline da família), versionado por `PRAGMA user_version`.
 * Espelha as tabelas do Postgres (supabase/migrations), com uuid em TEXT, boolean em
 * INTEGER 0/1 e dinheiro em REAL arredondado a centavos.
 *
 * Regra: nunca editar uma migração publicada; acrescentar uma nova no fim da lista.
 */
const MIGRATIONS: string[] = [
  // 1 — v2.0.0
  `
  CREATE TABLE families (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_by  TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE members (
    family_id   TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'MEMBER',
    active      INTEGER NOT NULL DEFAULT 1,
    name        TEXT NOT NULL,
    avatar_url  TEXT,
    PRIMARY KEY (family_id, user_id)
  );

  CREATE TABLE categories (
    id            TEXT PRIMARY KEY,
    family_id     TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    type          TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    color         TEXT,
    icon          TEXT,
    monthly_limit REAL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    change_xid    TEXT
  );
  CREATE UNIQUE INDEX categories_family_type_name_uq ON categories (family_id, type, name) WHERE deleted_at IS NULL;

  CREATE TABLE credit_cards (
    id          TEXT PRIMARY KEY,
    family_id   TEXT NOT NULL,
    owner_id    TEXT,
    description TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#8b5cf6',
    due_day     INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT,
    change_xid  TEXT
  );

  CREATE TABLE fixed_expenses (
    id             TEXT PRIMARY KEY,
    family_id      TEXT NOT NULL,
    member_id      TEXT,
    description    TEXT NOT NULL,
    amount         REAL NOT NULL CHECK (amount > 0),
    type           TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (type IN ('INCOME', 'EXPENSE')),
    category_id    TEXT,
    credit_card_id TEXT,
    recurrence     TEXT NOT NULL DEFAULT 'MONTHLY',
    due_day        INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    start_date     TEXT NOT NULL,
    end_date       TEXT,
    active         INTEGER NOT NULL DEFAULT 1,
    notes          TEXT,
    created_by     TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    deleted_at     TEXT,
    change_xid     TEXT
  );
  CREATE INDEX fixed_expenses_family_idx ON fixed_expenses (family_id) WHERE deleted_at IS NULL;

  CREATE TABLE fixed_expense_payments (
    id               TEXT PRIMARY KEY,
    family_id        TEXT NOT NULL,
    fixed_expense_id TEXT NOT NULL,
    year_month       TEXT NOT NULL,
    paid_by          TEXT NOT NULL,
    paid_at          TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    deleted_at       TEXT,
    change_xid       TEXT,
    UNIQUE (fixed_expense_id, year_month)
  );

  CREATE TABLE movements (
    id               TEXT PRIMARY KEY,
    family_id        TEXT NOT NULL,
    member_id        TEXT NOT NULL,
    to_member_id     TEXT,
    created_by       TEXT NOT NULL,
    description      TEXT NOT NULL,
    amount           REAL NOT NULL CHECK (amount > 0),
    date             TEXT NOT NULL,
    type             TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    category_id      TEXT,
    credit_card_id   TEXT,
    fixed_expense_id TEXT,
    notes            TEXT,
    import_hash      TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    deleted_at       TEXT,
    change_xid       TEXT,
    CHECK (
      (type = 'TRANSFER' AND to_member_id IS NOT NULL AND to_member_id <> member_id AND category_id IS NULL)
      OR (type <> 'TRANSFER' AND to_member_id IS NULL)
    )
  );
  CREATE INDEX movements_family_date_idx ON movements (family_id, date) WHERE deleted_at IS NULL;
  CREATE INDEX movements_family_member_date_idx ON movements (family_id, member_id, date) WHERE deleted_at IS NULL;
  CREATE INDEX movements_card_idx ON movements (credit_card_id, date) WHERE credit_card_id IS NOT NULL AND deleted_at IS NULL;
  CREATE INDEX movements_category_idx ON movements (category_id, date) WHERE category_id IS NOT NULL AND deleted_at IS NULL;
  CREATE INDEX movements_fixed_idx ON movements (fixed_expense_id) WHERE fixed_expense_id IS NOT NULL;
  CREATE UNIQUE INDEX movements_import_hash_uq ON movements (family_id, import_hash)
    WHERE import_hash IS NOT NULL AND deleted_at IS NULL;

  -- Fila de envio: uma entrada por linha alterada (compactada)
  CREATE TABLE _outbox (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name  TEXT NOT NULL,
    row_id      TEXT NOT NULL,
    base_xid    TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT,
    UNIQUE (table_name, row_id)
  );

  CREATE TABLE _sync_state (
    family_id     TEXT PRIMARY KEY,
    cursor        TEXT,
    last_pull_at  TEXT,
    last_push_at  TEXT
  );

  CREATE TABLE _sync_conflicts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id   TEXT NOT NULL,
    table_name  TEXT NOT NULL,
    row_id      TEXT NOT NULL,
    detected_at TEXT NOT NULL
  );
  `,
  // v2 (Etapa 7): visão por membro também olha quem RECEBE transferências
  `
  CREATE INDEX IF NOT EXISTS movements_family_to_member_idx ON movements (family_id, to_member_id)
    WHERE to_member_id IS NOT NULL AND deleted_at IS NULL;
  `,
];

export const LOCAL_SCHEMA_VERSION = MIGRATIONS.length;

/** Aplica as migrações pendentes. Idempotente: pode ser chamada a cada abertura do app. */
export async function migrateLocalDatabase(db: DbAdapter): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = Number(row?.user_version ?? 0);
  if (current > LOCAL_SCHEMA_VERSION) {
    throw new Error(
      `O banco local é de uma versão mais nova do app (schema ${current}). Atualize o MyFinances.`,
    );
  }
  for (let version = current + 1; version <= LOCAL_SCHEMA_VERSION; version++) {
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[version - 1]);
      await tx.exec(`PRAGMA user_version = ${version}`);
    });
  }
  await db.exec('PRAGMA foreign_keys = ON');
  return LOCAL_SCHEMA_VERSION;
}
