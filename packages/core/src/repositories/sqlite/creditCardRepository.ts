import type { SqlParam } from '../../db/adapter';
import type { WriteContext } from '../../db/localStore';
import type { CreditCardData, CreditCardListQuery, CreditCardRepository } from '../../domain/repositories';
import type { CreditCard, PaginatedResult, Uuid } from '../../domain/types';
import { SqliteRepository, bool, likeParam, pageClause, safeOrder, sqlDirection, toPage } from './base';

const ORDER = ['description', 'due_day', 'active'] as const;
const COLUMNS = 'id, owner_id, description, color, due_day, active, created_at';
const map = (r: any): CreditCard => ({ ...r, active: bool(r.active) });

export class SqliteCreditCardRepository extends SqliteRepository implements CreditCardRepository {
  async list(query: CreditCardListQuery): Promise<PaginatedResult<CreditCard>> {
    const where = ['family_id = ?', 'deleted_at IS NULL', 'description LIKE ?'];
    const params: SqlParam[] = [this.familyId(), likeParam(query.search)];
    if (query.onlyActive) where.push('active = 1');
    const whereSql = where.join(' AND ');
    const total = (await this.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM credit_cards WHERE ${whereSql}`, params))?.n ?? 0;
    const field = safeOrder(query.orderField, ORDER, 'description');
    const page = pageClause(query);
    const rows = await this.db.all(
      `SELECT ${COLUMNS} FROM credit_cards WHERE ${whereSql}
       ORDER BY ${field} ${sqlDirection(query.orderDirection)}, description ASC${page.sql}`,
      [...params, ...page.params],
    );
    return toPage(rows.map(map), total, query);
  }

  async findById(id: Uuid): Promise<CreditCard | null> {
    const row = await this.db.first(`SELECT ${COLUMNS} FROM credit_cards WHERE id = ? AND family_id = ? AND deleted_at IS NULL`, [
      id,
      this.familyId(),
    ]);
    return row ? map(row) : null;
  }

  async create(ctx: WriteContext, data: CreditCardData): Promise<Uuid> {
    const id = this.store.newId();
    const now = ctx.now();
    await ctx.tx.run(
      `INSERT INTO credit_cards (id, family_id, owner_id, description, color, due_day, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, this.familyId(), data.owner_id, data.description, data.color, data.due_day, data.active ? 1 : 0, now, now],
    );
    await ctx.markDirty('credit_cards', id);
    return id;
  }

  async update(ctx: WriteContext, id: Uuid, data: CreditCardData): Promise<void> {
    await ctx.tx.run(
      `UPDATE credit_cards SET owner_id = ?, description = ?, color = ?, due_day = ?, active = ?, updated_at = ?
       WHERE id = ? AND family_id = ? AND deleted_at IS NULL`,
      [data.owner_id, data.description, data.color, data.due_day, data.active ? 1 : 0, ctx.now(), id, this.familyId()],
    );
    await ctx.markDirty('credit_cards', id);
  }

  async softDelete(ctx: WriteContext, id: Uuid): Promise<void> {
    const familyId = this.familyId();
    const now = ctx.now();
    for (const table of ['movements', 'fixed_expenses'] as const) {
      const ids = await ctx.markDirtyWhere(table, 'family_id = ? AND credit_card_id = ? AND deleted_at IS NULL', [familyId, id]);
      if (ids.length) {
        await ctx.tx.run(
          `UPDATE ${table} SET credit_card_id = NULL, updated_at = ? WHERE family_id = ? AND credit_card_id = ? AND deleted_at IS NULL`,
          [now, familyId, id],
        );
      }
    }
    await ctx.tx.run('UPDATE credit_cards SET deleted_at = ?, updated_at = ? WHERE id = ? AND family_id = ?', [now, now, id, familyId]);
    await ctx.markDirty('credit_cards', id);
  }
}
