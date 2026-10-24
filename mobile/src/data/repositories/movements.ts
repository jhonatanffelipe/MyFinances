import { getDb, mutate } from '../db';
import { SqlParam } from '../adapter';
import { Movement, MovementFilters, TransactionType } from '../types';

export const MOVEMENT_SELECT = `
  SELECT m.*,
         c.name AS category_name, c.color AS category_color,
         cc.description AS credit_card_name, cc.color AS credit_card_color,
         cc.due_day AS credit_card_due_day
  FROM movements m
  LEFT JOIN categories c ON m.category_id = c.id
  LEFT JOIN credit_cards cc ON m.credit_card_id = cc.id
`;

export interface MovementSummary {
  totalIncome: number;
  totalExpense: number;
  incomeCount: number;
  expenseCount: number;
}

export interface MovementListResult {
  data: Movement[];
  summary: MovementSummary;
}

export type MovementInput = {
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category_id: number | null;
  credit_card_id?: number | null;
  notes?: string;
};

/** Calcula a data de vencimento (YYYY-MM-DD) do cartão no mês de referência. */
function formatCardDueDate(yearMonth: string, dueDay: number): string {
  const [y, m] = yearMonth.split('-').map((v) => parseInt(v, 10));
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(dueDay || 1, 1), lastDay);
  return `${yearMonth}-${String(day).padStart(2, '0')}`;
}

/**
 * Lista movimentações do período. Por padrão agrupa lançamentos de cartão em uma
 * linha "Fatura" por cartão + mês (mesma regra do desktop). Com um cartão
 * específico, 'none' (sem cartão) ou 'all_ungrouped', retorna os itens detalhados.
 */
export async function listMovements(filters: MovementFilters = {}): Promise<MovementListResult> {
  const db = getDb();
  const { startDate, endDate, categoryId, creditCardId, type, search, excludeSearch } = filters;

  const conditions: string[] = ['1=1'];
  const params: SqlParam[] = [];

  if (startDate) { conditions.push('m.date >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('m.date <= ?'); params.push(endDate); }
  if (categoryId) { conditions.push('m.category_id = ?'); params.push(categoryId); }

  const numericCardId =
    typeof creditCardId === 'number'
      ? creditCardId
      : typeof creditCardId === 'string' && /^\d+$/.test(creditCardId.trim())
        ? parseInt(creditCardId.trim(), 10)
        : null;
  const isSpecificCard = numericCardId !== null && numericCardId > 0;
  const isOnlyNonCard = creditCardId === 'none';
  const shouldGroup = !isSpecificCard && !isOnlyNonCard && creditCardId !== 'all_ungrouped';

  if (isSpecificCard) {
    conditions.push('m.credit_card_id = ?');
    params.push(numericCardId);
  } else if (isOnlyNonCard) {
    conditions.push('m.credit_card_id IS NULL');
  }
  if (type && type !== 'ALL') {
    conditions.push('m.type = ?');
    params.push(type);
  }
  if (search) {
    conditions.push('(m.description LIKE ? OR m.notes LIKE ? OR cc.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (excludeSearch) {
    conditions.push('(m.description NOT LIKE ? AND (m.notes IS NULL OR m.notes NOT LIKE ?))');
    params.push(`%${excludeSearch}%`, `%${excludeSearch}%`);
  }

  const where = conditions.join(' AND ');

  const summary = (await db.first<MovementSummary>(
    `SELECT
       COALESCE(SUM(CASE WHEN m.type = 'INCOME' THEN m.amount ELSE 0 END), 0) as totalIncome,
       COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN m.amount ELSE 0 END), 0) as totalExpense,
       COALESCE(SUM(CASE WHEN m.type = 'INCOME' THEN 1 ELSE 0 END), 0) as incomeCount,
       COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN 1 ELSE 0 END), 0) as expenseCount
     FROM movements m
     LEFT JOIN categories c ON m.category_id = c.id
     LEFT JOIN credit_cards cc ON m.credit_card_id = cc.id
     WHERE ${where}`,
    params
  )) || { totalIncome: 0, totalExpense: 0, incomeCount: 0, expenseCount: 0 };

  const rows = await db.all<any>(`${MOVEMENT_SELECT} WHERE ${where} ORDER BY m.date DESC, m.id DESC`, params);

  if (!shouldGroup) {
    return { data: rows, summary };
  }

  const nonCard: Movement[] = [];
  const groups = new Map<string, { cardId: number; cardName: string; cardColor: string; dueDay: number; yearMonth: string; items: Movement[] }>();

  for (const m of rows) {
    if (!m.credit_card_id) {
      nonCard.push(m);
      continue;
    }
    const ym = typeof m.date === 'string' && m.date.length >= 7 ? m.date.substring(0, 7) : (startDate || '').substring(0, 7);
    const key = `${m.credit_card_id}_${ym}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        cardId: m.credit_card_id,
        cardName: m.credit_card_name || 'Cartão de Crédito',
        cardColor: m.credit_card_color || '#8b5cf6',
        dueDay: m.credit_card_due_day || 10,
        yearMonth: ym,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(m);
  }

  const grouped: Movement[] = [];
  for (const group of groups.values()) {
    let net = 0;
    for (const item of group.items) {
      net += item.type === 'EXPENSE' ? Number(item.amount) : -Number(item.amount);
    }
    const rowType: TransactionType = net >= 0 ? 'EXPENSE' : 'INCOME';
    if (type && type !== 'ALL' && type !== rowType) continue;
    const [gy, gm] = group.yearMonth.split('-').map((v) => parseInt(v, 10) || 0);
    grouped.push({
      id: -(group.cardId * 1000000 + gy * 100 + gm),
      groupKey: `${group.cardId}_${group.yearMonth}`,
      description: `Fatura - ${group.cardName}`,
      amount: Math.round(Math.abs(net) * 100) / 100,
      date: formatCardDueDate(group.yearMonth, group.dueDay),
      type: rowType,
      category_id: 0,
      category_name: 'Fatura de Cartão',
      category_color: group.cardColor,
      credit_card_id: group.cardId,
      credit_card_name: group.cardName,
      credit_card_color: group.cardColor,
      notes: `${group.items.length} lançamento(s) agrupado(s) nesta fatura`,
      isGroupedCard: true,
      cardMovementCount: group.items.length,
      cardMovements: group.items,
    });
  }

  const data = [...nonCard, ...grouped].sort(
    (a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id
  );
  return { data, summary };
}

export async function getMovement(id: number): Promise<Movement | null> {
  return getDb().first<Movement>(`${MOVEMENT_SELECT} WHERE m.id = ?`, [id]);
}

export async function createMovement(mov: MovementInput): Promise<number> {
  return mutate(async (tx) => {
    const res = await tx.run(
      'INSERT INTO movements (description, amount, date, type, category_id, credit_card_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [mov.description, mov.amount, mov.date, mov.type, mov.category_id, mov.credit_card_id || null, mov.notes || '']
    );
    return res.lastInsertRowId;
  });
}

export async function updateMovement(id: number, mov: MovementInput): Promise<void> {
  await mutate((tx) =>
    tx.run(
      'UPDATE movements SET description = ?, amount = ?, date = ?, type = ?, category_id = ?, credit_card_id = ?, notes = ? WHERE id = ?',
      [mov.description, mov.amount, mov.date, mov.type, mov.category_id, mov.credit_card_id || null, mov.notes || '', id]
    )
  );
}

export async function deleteMovement(id: number): Promise<void> {
  await mutate((tx) => tx.run('DELETE FROM movements WHERE id = ?', [id]));
}

// ---- Exclusão em lote por cartão + mês (mesmo critério do agrupamento de faturas) ----
const BULK_WHERE = 'credit_card_id = ? AND substr(date, 1, 7) = ?';

export interface BulkDeletePreview {
  count: number;
  totalExpense: number;
  totalIncome: number;
  fixedCount: number;
}

function assertBulkParams(creditCardId: number, yearMonth: string) {
  if (!Number.isInteger(creditCardId) || creditCardId <= 0) throw new Error('Cartão inválido');
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) throw new Error('Mês inválido (esperado YYYY-MM)');
}

export async function previewBulkDeleteCard(creditCardId: number, yearMonth: string): Promise<BulkDeletePreview> {
  assertBulkParams(creditCardId, yearMonth);
  const row = await getDb().first<any>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS totalExpense,
            COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) AS totalIncome,
            COALESCE(SUM(CASE WHEN fixed_expense_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS fixedCount
     FROM movements WHERE ${BULK_WHERE}`,
    [creditCardId, yearMonth]
  );
  return {
    count: Number(row?.count || 0),
    totalExpense: Number(row?.totalExpense || 0),
    totalIncome: Number(row?.totalIncome || 0),
    fixedCount: Number(row?.fixedCount || 0),
  };
}

export async function bulkDeleteCard(creditCardId: number, yearMonth: string): Promise<number> {
  assertBulkParams(creditCardId, yearMonth);
  return mutate(async (tx) => {
    const res = await tx.run(`DELETE FROM movements WHERE ${BULK_WHERE}`, [creditCardId, yearMonth]);
    return res.changes;
  });
}
