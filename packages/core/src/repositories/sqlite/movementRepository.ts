import type { SqlParam } from '../../db/adapter';
import type { WriteContext } from '../../db/localStore';
import type {
  BulkDeletePreview,
  MovementData,
  MovementFilters,
  MovementRepository,
} from '../../domain/repositories';
import type { Movement, MovementSummary, Uuid } from '../../domain/types';
import { SqliteRepository, pageClause, safeOrder, sqlDirection } from './base';

const ORDER = ['date', 'amount', 'description', 'type'] as const;

const SELECT = `
  SELECT m.id, m.member_id, m.to_member_id, m.created_by, m.description, m.amount, m.date, m.type,
         m.category_id, m.credit_card_id, m.fixed_expense_id, m.notes, m.import_hash, m.created_at, m.updated_at,
         c.name AS category_name, c.color AS category_color,
         cc.description AS credit_card_name, cc.color AS credit_card_color, cc.due_day AS credit_card_due_day,
         mb.name AS member_name, tm.name AS to_member_name
  FROM movements m
  LEFT JOIN categories c    ON c.id = m.category_id AND c.deleted_at IS NULL
  LEFT JOIN credit_cards cc ON cc.id = m.credit_card_id AND cc.deleted_at IS NULL
  LEFT JOIN members mb      ON mb.family_id = m.family_id AND mb.user_id = m.member_id
  LEFT JOIN members tm      ON tm.family_id = m.family_id AND tm.user_id = m.to_member_id
`;

/** Mesmo critério do agrupamento de faturas: cartão + mês da data do lançamento. */
const CARD_MONTH = 'credit_card_id = ? AND substr(date, 1, 7) = ?';

export class SqliteMovementRepository extends SqliteRepository implements MovementRepository {
  private where(filters: MovementFilters): { sql: string; params: SqlParam[] } {
    const conditions = ['m.family_id = ?', 'm.deleted_at IS NULL'];
    const params: SqlParam[] = [this.familyId()];
    const { startDate, endDate, categoryId, creditCardId, type, memberId, search, excludeSearch } = filters;

    if (startDate) {
      conditions.push('m.date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('m.date <= ?');
      params.push(endDate);
    }
    if (categoryId) {
      conditions.push('m.category_id = ?');
      params.push(categoryId);
    }
    if (creditCardId === 'none') {
      conditions.push('m.credit_card_id IS NULL');
    } else if (creditCardId && creditCardId !== 'all_ungrouped') {
      conditions.push('m.credit_card_id = ?');
      params.push(creditCardId);
    }
    if (type && type !== 'ALL') {
      conditions.push('m.type = ?');
      params.push(type);
    }
    if (memberId) {
      conditions.push('(m.member_id = ? OR m.to_member_id = ?)');
      params.push(memberId, memberId);
    }
    if (search) {
      conditions.push(
        `(m.description LIKE ? OR m.notes LIKE ? OR m.credit_card_id IN
           (SELECT id FROM credit_cards WHERE family_id = m.family_id AND description LIKE ?))`,
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (excludeSearch) {
      conditions.push('(m.description NOT LIKE ? AND (m.notes IS NULL OR m.notes NOT LIKE ?))');
      params.push(`%${excludeSearch}%`, `%${excludeSearch}%`);
    }
    return { sql: conditions.join(' AND '), params };
  }

  async findMany(filters: MovementFilters): Promise<Movement[]> {
    const where = this.where(filters);
    const field = safeOrder(filters.orderField, ORDER, 'date');
    const dir = sqlDirection(filters.orderDirection, 'desc');
    const page = pageClause(filters);
    return this.db.all<Movement>(
      `${SELECT} WHERE ${where.sql} ORDER BY m.${field} ${dir}, m.created_at ${dir}, m.id ${dir}${page.sql}`,
      [...where.params, ...page.params],
    );
  }

  async count(filters: MovementFilters): Promise<number> {
    const where = this.where(filters);
    return (await this.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM movements m WHERE ${where.sql}`, where.params))?.n ?? 0;
  }

  /** Receitas e despesas do filtro. Transferências não entram (não são receita nem despesa). */
  async summary(filters: MovementFilters): Promise<MovementSummary> {
    const where = this.where(filters);
    const row = await this.db.first<MovementSummary>(
      `SELECT COALESCE(SUM(CASE WHEN m.type = 'INCOME'  THEN m.amount ELSE 0 END), 0) AS totalIncome,
              COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN m.amount ELSE 0 END), 0) AS totalExpense,
              COALESCE(SUM(CASE WHEN m.type = 'INCOME'  THEN 1 ELSE 0 END), 0) AS incomeCount,
              COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN 1 ELSE 0 END), 0) AS expenseCount
       FROM movements m WHERE ${where.sql}`,
      where.params,
    );
    return row ?? { totalIncome: 0, totalExpense: 0, incomeCount: 0, expenseCount: 0 };
  }

  findById(id: Uuid): Promise<Movement | null> {
    return this.db.first<Movement>(`${SELECT} WHERE m.id = ? AND m.family_id = ? AND m.deleted_at IS NULL`, [id, this.familyId()]);
  }

  async existingImportHashes(hashes: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    const familyId = this.familyId();
    // Lotes de 500 para não estourar o limite de parâmetros do SQLite
    for (let i = 0; i < hashes.length; i += 500) {
      const chunk = hashes.slice(i, i + 500);
      const rows = await this.db.all<{ import_hash: string }>(
        `SELECT import_hash FROM movements WHERE family_id = ? AND deleted_at IS NULL
           AND import_hash IN (${chunk.map(() => '?').join(',')})`,
        [familyId, ...chunk],
      );
      rows.forEach((r) => found.add(r.import_hash));
    }
    return found;
  }

  async create(ctx: WriteContext, data: MovementData): Promise<Uuid> {
    const id = this.store.newId();
    const now = ctx.now();
    await ctx.tx.run(
      `INSERT INTO movements (id, family_id, member_id, to_member_id, created_by, description, amount, date, type,
                              category_id, credit_card_id, fixed_expense_id, notes, import_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, this.familyId(), data.member_id, data.to_member_id, this.userId(), data.description, data.amount, data.date,
        data.type, data.category_id, data.credit_card_id, data.fixed_expense_id ?? null, data.notes, data.import_hash ?? null,
        now, now,
      ],
    );
    await ctx.markDirty('movements', id);
    return id;
  }

  async update(ctx: WriteContext, id: Uuid, data: MovementData): Promise<void> {
    // created_by nunca muda: é a auditoria de quem lançou
    await ctx.tx.run(
      `UPDATE movements SET member_id = ?, to_member_id = ?, description = ?, amount = ?, date = ?, type = ?,
              category_id = ?, credit_card_id = ?, notes = ?, updated_at = ?
       WHERE id = ? AND family_id = ? AND deleted_at IS NULL`,
      [
        data.member_id, data.to_member_id, data.description, data.amount, data.date, data.type,
        data.category_id, data.credit_card_id, data.notes, ctx.now(), id, this.familyId(),
      ],
    );
    await ctx.markDirty('movements', id);
  }

  async softDelete(ctx: WriteContext, id: Uuid): Promise<void> {
    const now = ctx.now();
    await ctx.tx.run('UPDATE movements SET deleted_at = ?, updated_at = ? WHERE id = ? AND family_id = ? AND deleted_at IS NULL', [
      now, now, id, this.familyId(),
    ]);
    await ctx.markDirty('movements', id);
  }

  async previewDeleteByCardMonth(cardId: Uuid, yearMonth: string): Promise<BulkDeletePreview> {
    const row = await this.db.first<any>(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS totalExpense,
              COALESCE(SUM(CASE WHEN type = 'INCOME'  THEN amount ELSE 0 END), 0) AS totalIncome,
              COALESCE(SUM(CASE WHEN fixed_expense_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS fixedCount
       FROM movements WHERE family_id = ? AND deleted_at IS NULL AND ${CARD_MONTH}`,
      [this.familyId(), cardId, yearMonth],
    );
    return {
      count: Number(row?.count ?? 0),
      totalExpense: Number(row?.totalExpense ?? 0),
      totalIncome: Number(row?.totalIncome ?? 0),
      fixedCount: Number(row?.fixedCount ?? 0),
    };
  }

  async softDeleteByCardMonth(ctx: WriteContext, cardId: Uuid, yearMonth: string): Promise<number> {
    return this.softDeleteWhere(ctx, CARD_MONTH, [cardId, yearMonth]);
  }

  async softDeleteByFixedExpense(ctx: WriteContext, fixedExpenseId: Uuid): Promise<number> {
    return this.softDeleteWhere(ctx, 'fixed_expense_id = ?', [fixedExpenseId]);
  }

  private async softDeleteWhere(ctx: WriteContext, condition: string, params: SqlParam[]): Promise<number> {
    const familyId = this.familyId();
    const ids = await ctx.markDirtyWhere('movements', `family_id = ? AND deleted_at IS NULL AND ${condition}`, [familyId, ...params]);
    if (ids.length === 0) return 0;
    const now = ctx.now();
    await ctx.tx.run(
      `UPDATE movements SET deleted_at = ?, updated_at = ? WHERE family_id = ? AND deleted_at IS NULL AND ${condition}`,
      [now, now, familyId, ...params],
    );
    return ids.length;
  }

  async importSnapshot() {
    const familyId = this.familyId();
    const [categories, movements, fixedExpenses] = await Promise.all([
      this.db.all('SELECT id, name, type FROM categories WHERE family_id = ? AND deleted_at IS NULL', [familyId]),
      this.db.all(
        `SELECT id, description, amount, date, credit_card_id, fixed_expense_id
         FROM movements WHERE family_id = ? AND deleted_at IS NULL AND type <> 'TRANSFER'`,
        [familyId],
      ),
      this.db.all(
        `SELECT id, description, amount, due_day, active FROM fixed_expenses
         WHERE family_id = ? AND deleted_at IS NULL AND active = 1 AND type = 'EXPENSE'`,
        [familyId],
      ),
    ]);
    return { categories, movements, fixedExpenses };
  }
}
