import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { getDatabase, persistDatabaseToDisk, queryObject, queryObjects } from '../database/index.js';
import { resolveYearMonth } from '../services/date.service.js';

/** Normaliza o tipo do lançamento fixo — registros antigos são sempre despesa. */
function normalizeType(type?: string): 'EXPENSE' | 'INCOME' {
  return type === 'INCOME' ? 'INCOME' : 'EXPENSE';
}

/** Gera movimentos automáticos para cada mês no período do lançamento fixo. */
export function generateFixedExpenseMovements(fixedExpenseId: number, exp: any) {
  const db = getDatabase();
  if (!db || !exp.end_date) return;

  const recurrenceStep: Record<string, number> = {
    MONTHLY: 1,
    BIMONTHLY: 2,
    QUARTERLY: 3,
    SEMIANNUAL: 6,
    ANNUAL: 12,
  };
  const step = recurrenceStep[exp.recurrence || 'MONTHLY'] || 1;
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
      db.run(
        `INSERT INTO movements
           (description, amount, date, type, category_id, credit_card_id, fixed_expense_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exp.description,
          exp.amount,
          dateStr,
          type,
          exp.category_id,
          // Cartão de crédito só faz sentido em despesas
          type === 'INCOME' ? null : exp.credit_card_id || null,
          fixedExpenseId,
          notes,
        ]
      );
    }

    current = new Date(current.getFullYear(), current.getMonth() + step, 1);
  }
}

export function registerFixedExpensesIpc() {
  ipcMain.handle(IPC_CHANNELS.FIXED_EXPENSES_LIST, async (_event, params: any = {}) => {
    const {
      page = 0,
      perPage = 10,
      search = '',
      orderField = 'due_day',
      orderDirection = 'asc',
      type,
    } = params || {};
    const offset = page * perPage;
    const dir = orderDirection === 'desc' ? 'DESC' : 'ASC';
    const allowedOrder = ['due_day', 'description', 'amount'].includes(orderField) ? orderField : 'due_day';
    const searchParam = search ? `%${search}%` : '%';
    const typeFilter = normalizeType(type);

    const total = queryObject(
      `SELECT COUNT(*) as count FROM fixed_expenses f
       WHERE f.description LIKE ? AND COALESCE(f.type, 'EXPENSE') = ?`,
      [searchParam, typeFilter]
    )?.count || 0;

    const data = queryObjects(
      `SELECT f.*,
              c.name AS category_name, c.color AS category_color,
              cc.description AS credit_card_name, cc.color AS credit_card_color
       FROM fixed_expenses f
       LEFT JOIN categories c ON f.category_id = c.id
       LEFT JOIN credit_cards cc ON f.credit_card_id = cc.id
       WHERE f.description LIKE ? AND COALESCE(f.type, 'EXPENSE') = ?
       ORDER BY f.${allowedOrder} ${dir}
       LIMIT ? OFFSET ?`,
      [searchParam, typeFilter, perPage, offset]
    );

    return { data, total, currentPage: page, perPage };
  });

  ipcMain.handle(IPC_CHANNELS.FIXED_EXPENSES_CREATE, async (_event, exp) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    const type = normalizeType(exp.type);

    db.run(
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

    const created = queryObject('SELECT * FROM fixed_expenses ORDER BY id DESC LIMIT 1');
    if (created) {
      generateFixedExpenseMovements(created.id, created);
    }

    persistDatabaseToDisk();
    return created;
  });

  ipcMain.handle(IPC_CHANNELS.FIXED_EXPENSES_UPDATE, async (_event, id, exp) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    const type = normalizeType(exp.type);

    db.run('DELETE FROM movements WHERE fixed_expense_id = ?', [id]);

    db.run(
      `UPDATE fixed_expenses SET description = ?, amount = ?, type = ?, category_id = ?, credit_card_id = ?,
              recurrence = ?, due_day = ?, start_date = ?, end_date = ?, active = ?, notes = ?
       WHERE id = ?`,
      [
        exp.description, exp.amount, type, exp.category_id,
        type === 'INCOME' ? null : exp.credit_card_id || null,
        exp.recurrence || 'MONTHLY', exp.due_day, exp.start_date, exp.end_date || null,
        exp.active ?? 1, exp.notes, id,
      ]
    );

    const updated = queryObject('SELECT * FROM fixed_expenses WHERE id = ?', [id]);
    if (updated) {
      generateFixedExpenseMovements(id, updated);
    }

    persistDatabaseToDisk();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.FIXED_EXPENSES_DELETE, async (_event, id) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run('DELETE FROM movements WHERE fixed_expense_id = ?', [id]);
    db.run('DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ?', [id]);
    db.run('DELETE FROM fixed_expenses WHERE id = ?', [id]);
    persistDatabaseToDisk();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.FIXED_EXPENSES_TOGGLE_PAID, async (_event, id: number, yearMonth: string, paid: boolean) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    const period = resolveYearMonth(yearMonth);
    if (paid) {
      db.run(
        'INSERT OR IGNORE INTO fixed_expense_payments (fixed_expense_id, year_month) VALUES (?, ?)',
        [id, period.yearMonth]
      );
    } else {
      db.run('DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ? AND year_month = ?', [id, period.yearMonth]);
    }
    persistDatabaseToDisk();
    return true;
  });
}
