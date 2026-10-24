import { DbAdapter } from '../adapter';
import { getDb, mutate } from '../db';
import { resolveYearMonth } from '../date';
import { FixedExpense, FixedExpenseRecurrence, TransactionType } from '../types';

export type FixedEntryInput = {
  description: string;
  amount: number;
  type: TransactionType;
  category_id: number | null;
  credit_card_id?: number | null;
  recurrence?: FixedExpenseRecurrence;
  due_day: number;
  start_date: string;
  end_date?: string | null;
  active?: number;
  notes?: string;
};

export const RECURRENCE_STEP: Record<FixedExpenseRecurrence, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export const RECURRENCE_LABEL: Record<FixedExpenseRecurrence, string> = {
  MONTHLY: 'Mensal',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

function normalizeType(type?: string): TransactionType {
  return type === 'INCOME' ? 'INCOME' : 'EXPENSE';
}

/** Gera os movimentos de cada mês do período do lançamento fixo (somente com data final). */
async function generateMovements(tx: DbAdapter, fixedId: number, exp: FixedEntryInput) {
  if (!exp.end_date) return;
  const step = RECURRENCE_STEP[exp.recurrence || 'MONTHLY'] || 1;
  const type = normalizeType(exp.type);
  const notes = type === 'INCOME' ? 'Receita fixa automática' : 'Despesa fixa automática';

  const start = new Date(exp.start_date + 'T00:00:00');
  const end = new Date(exp.end_date + 'T00:00:00');
  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const day = Math.min(exp.due_day, daysInMonth);
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr >= exp.start_date && dateStr <= exp.end_date) {
      await tx.run(
        `INSERT INTO movements (description, amount, date, type, category_id, credit_card_id, fixed_expense_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [exp.description, exp.amount, dateStr, type, exp.category_id, type === 'INCOME' ? null : exp.credit_card_id || null, fixedId, notes]
      );
    }
    current = new Date(current.getFullYear(), current.getMonth() + step, 1);
  }
}

/** Lista lançamentos fixos do tipo, com a baixa (pago) do mês de referência. */
export async function listFixedEntries(type: TransactionType, yearMonth?: string) {
  const period = resolveYearMonth(yearMonth);
  return getDb().all<FixedExpense>(
    `SELECT f.*,
            c.name AS category_name, c.color AS category_color,
            cc.description AS credit_card_name, cc.color AS credit_card_color,
            CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS paid
     FROM fixed_expenses f
     LEFT JOIN categories c ON f.category_id = c.id
     LEFT JOIN credit_cards cc ON f.credit_card_id = cc.id
     LEFT JOIN fixed_expense_payments p ON p.fixed_expense_id = f.id AND p.year_month = ?
     WHERE COALESCE(f.type, 'EXPENSE') = ?
     ORDER BY f.active DESC, f.due_day ASC, f.description ASC`,
    [period.yearMonth, normalizeType(type)]
  );
}

export async function getFixedEntry(id: number) {
  return getDb().first<FixedExpense>('SELECT * FROM fixed_expenses WHERE id = ?', [id]);
}

export async function createFixedEntry(exp: FixedEntryInput) {
  return mutate(async (tx) => {
    const type = normalizeType(exp.type);
    const res = await tx.run(
      `INSERT INTO fixed_expenses
         (description, amount, type, category_id, credit_card_id, recurrence, due_day, start_date, end_date, active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exp.description, exp.amount, type, exp.category_id,
        type === 'INCOME' ? null : exp.credit_card_id || null,
        exp.recurrence || 'MONTHLY', exp.due_day, exp.start_date, exp.end_date || null,
        exp.active ?? 1, exp.notes || '',
      ]
    );
    await generateMovements(tx, res.lastInsertRowId, { ...exp, type });
    return res.lastInsertRowId;
  });
}

export async function updateFixedEntry(id: number, exp: FixedEntryInput) {
  await mutate(async (tx) => {
    const type = normalizeType(exp.type);
    await tx.run('DELETE FROM movements WHERE fixed_expense_id = ?', [id]);
    await tx.run(
      `UPDATE fixed_expenses SET description = ?, amount = ?, type = ?, category_id = ?, credit_card_id = ?,
              recurrence = ?, due_day = ?, start_date = ?, end_date = ?, active = ?, notes = ?
       WHERE id = ?`,
      [
        exp.description, exp.amount, type, exp.category_id,
        type === 'INCOME' ? null : exp.credit_card_id || null,
        exp.recurrence || 'MONTHLY', exp.due_day, exp.start_date, exp.end_date || null,
        exp.active ?? 1, exp.notes || '', id,
      ]
    );
    await generateMovements(tx, id, { ...exp, type });
  });
}

export async function deleteFixedEntry(id: number) {
  await mutate(async (tx) => {
    await tx.run('DELETE FROM movements WHERE fixed_expense_id = ?', [id]);
    await tx.run('DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ?', [id]);
    await tx.run('DELETE FROM fixed_expenses WHERE id = ?', [id]);
  });
}

export async function setFixedEntryPaid(id: number, yearMonth: string, paid: boolean) {
  const period = resolveYearMonth(yearMonth);
  await mutate((tx) =>
    paid
      ? tx.run('INSERT OR IGNORE INTO fixed_expense_payments (fixed_expense_id, year_month) VALUES (?, ?)', [id, period.yearMonth])
      : tx.run('DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ? AND year_month = ?', [id, period.yearMonth])
  );
}
