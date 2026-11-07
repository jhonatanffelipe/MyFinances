import type { SqlParam } from '../../db/adapter';
import type { WriteContext } from '../../db/localStore';
import type { FixedExpenseData, FixedExpenseListQuery, FixedExpenseRepository } from '../../domain/repositories';
import { resolveYearMonth } from '../../domain/date';
import type { FixedExpense, PaginatedResult, Uuid } from '../../domain/types';
import { SqliteRepository, bool, likeParam, pageClause, safeOrder, sqlDirection, toPage } from './base';

const ORDER = ['due_day', 'description', 'amount'] as const;

export const FIXED_SELECT = `
  SELECT f.id, f.member_id, f.description, f.amount, f.type, f.category_id, f.credit_card_id, f.recurrence,
         f.due_day, f.start_date, f.end_date, f.active, f.notes, f.created_by, f.created_at,
         c.name AS category_name, c.color AS category_color,
         cc.description AS credit_card_name, cc.color AS credit_card_color,
         CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS paid
  FROM fixed_expenses f
  LEFT JOIN categories c    ON c.id = f.category_id AND c.deleted_at IS NULL
  LEFT JOIN credit_cards cc ON cc.id = f.credit_card_id AND cc.deleted_at IS NULL
  LEFT JOIN fixed_expense_payments p
         ON p.fixed_expense_id = f.id AND p.year_month = ? AND p.deleted_at IS NULL
`;

export const mapFixed = (r: any): FixedExpense => ({ ...r, active: bool(r.active), paid: bool(r.paid) });

export class SqliteFixedExpenseRepository extends SqliteRepository implements FixedExpenseRepository {
  async list(query: FixedExpenseListQuery): Promise<PaginatedResult<FixedExpense>> {
    const period = resolveYearMonth(query.yearMonth);
    const where = ['f.family_id = ?', 'f.deleted_at IS NULL', 'f.description LIKE ?', 'f.type = ?'];
    const params: SqlParam[] = [this.familyId(), likeParam(query.search), query.type === 'INCOME' ? 'INCOME' : 'EXPENSE'];
    const whereSql = where.join(' AND ');
    const total = (await this.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM fixed_expenses f WHERE ${whereSql}`, params))?.n ?? 0;
    const orderSql = query.orderField
      ? `f.${safeOrder(query.orderField, ORDER, 'due_day')} ${sqlDirection(query.orderDirection)}, f.description ASC`
      : 'f.active DESC, f.due_day ASC, f.description ASC';
    const page = pageClause(query);
    const rows = await this.db.all(`${FIXED_SELECT} WHERE ${whereSql} ORDER BY ${orderSql}${page.sql}`, [
      period.yearMonth,
      ...params,
      ...page.params,
    ]);
    return toPage(rows.map(mapFixed), total, query);
  }

  async findById(id: Uuid): Promise<FixedExpense | null> {
    const row = await this.db.first(`${FIXED_SELECT} WHERE f.id = ? AND f.family_id = ? AND f.deleted_at IS NULL`, [
      '',
      id,
      this.familyId(),
    ]);
    return row ? mapFixed(row) : null;
  }

  async create(ctx: WriteContext, data: FixedExpenseData): Promise<Uuid> {
    const id = this.store.newId();
    const now = ctx.now();
    await ctx.tx.run(
      `INSERT INTO fixed_expenses (id, family_id, member_id, description, amount, type, category_id, credit_card_id, recurrence,
                                   due_day, start_date, end_date, active, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, this.familyId(), data.member_id, data.description, data.amount, data.type, data.category_id, data.credit_card_id,
        data.recurrence, data.due_day, data.start_date, data.end_date, data.active ? 1 : 0, data.notes, this.userId(), now, now,
      ],
    );
    await ctx.markDirty('fixed_expenses', id);
    return id;
  }

  async update(ctx: WriteContext, id: Uuid, data: FixedExpenseData): Promise<void> {
    await ctx.tx.run(
      `UPDATE fixed_expenses SET member_id = ?, description = ?, amount = ?, type = ?, category_id = ?, credit_card_id = ?,
              recurrence = ?, due_day = ?, start_date = ?, end_date = ?, active = ?, notes = ?, updated_at = ?
       WHERE id = ? AND family_id = ? AND deleted_at IS NULL`,
      [
        data.member_id, data.description, data.amount, data.type, data.category_id, data.credit_card_id, data.recurrence,
        data.due_day, data.start_date, data.end_date, data.active ? 1 : 0, data.notes, ctx.now(), id, this.familyId(),
      ],
    );
    await ctx.markDirty('fixed_expenses', id);
  }

  async softDelete(ctx: WriteContext, id: Uuid): Promise<void> {
    const familyId = this.familyId();
    const now = ctx.now();
    const payments = await ctx.markDirtyWhere('fixed_expense_payments', 'family_id = ? AND fixed_expense_id = ? AND deleted_at IS NULL', [
      familyId,
      id,
    ]);
    if (payments.length) {
      await ctx.tx.run(
        'UPDATE fixed_expense_payments SET deleted_at = ?, updated_at = ? WHERE family_id = ? AND fixed_expense_id = ? AND deleted_at IS NULL',
        [now, now, familyId, id],
      );
    }
    await ctx.tx.run('UPDATE fixed_expenses SET deleted_at = ?, updated_at = ? WHERE id = ? AND family_id = ?', [now, now, id, familyId]);
    await ctx.markDirty('fixed_expenses', id);
  }

  /**
   * Baixa do mês. A linha é única por (fixo, mês) também no servidor, então desfazer
   * a baixa é soft delete e refazer reaproveita a MESMA linha (nunca cria outra).
   */
  async setPaid(ctx: WriteContext, id: Uuid, yearMonth: string, paid: boolean): Promise<void> {
    const familyId = this.familyId();
    const now = ctx.now();
    const existing = await ctx.tx.first<{ id: string; deleted_at: string | null }>(
      'SELECT id, deleted_at FROM fixed_expense_payments WHERE fixed_expense_id = ? AND year_month = ?',
      [id, yearMonth],
    );
    if (paid) {
      if (existing && existing.deleted_at === null) return;
      if (existing) {
        await ctx.tx.run(
          'UPDATE fixed_expense_payments SET deleted_at = NULL, paid_by = ?, paid_at = ?, updated_at = ? WHERE id = ?',
          [this.userId(), now, now, existing.id],
        );
        await ctx.markDirty('fixed_expense_payments', existing.id);
        return;
      }
      const paymentId = this.store.newId();
      await ctx.tx.run(
        `INSERT INTO fixed_expense_payments (id, family_id, fixed_expense_id, year_month, paid_by, paid_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, familyId, id, yearMonth, this.userId(), now, now, now],
      );
      await ctx.markDirty('fixed_expense_payments', paymentId);
      return;
    }
    if (!existing || existing.deleted_at !== null) return;
    await ctx.tx.run('UPDATE fixed_expense_payments SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, existing.id]);
    await ctx.markDirty('fixed_expense_payments', existing.id);
  }
}
