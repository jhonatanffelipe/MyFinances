import type { SqlParam } from '../../db/adapter';
import type { WriteContext } from '../../db/localStore';
import type { CategoryData, CategoryListQuery, CategoryRepository } from '../../domain/repositories';
import { resolveYearMonth } from '../../domain/date';
import type { Category, PaginatedResult, TransactionType, Uuid } from '../../domain/types';
import { SqliteRepository, likeParam, pageClause, safeOrder, sqlDirection, toPage } from './base';

const ORDER = ['name', 'type', 'monthly_limit', 'consumed'] as const;

export class SqliteCategoryRepository extends SqliteRepository implements CategoryRepository {
  async list(query: CategoryListQuery): Promise<PaginatedResult<Category>> {
    const familyId = this.familyId();
    const period = resolveYearMonth(query.yearMonth);
    const where = ['c.family_id = ?', 'c.deleted_at IS NULL', 'c.name LIKE ?'];
    const params: SqlParam[] = [familyId, likeParam(query.search)];
    if (query.type && query.type !== 'ALL') {
      where.push('c.type = ?');
      params.push(query.type);
    }
    const whereSql = where.join(' AND ');
    const total = (await this.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM categories c WHERE ${whereSql}`, params))?.n ?? 0;

    const field = safeOrder(query.orderField, ORDER, 'name');
    const dir = sqlDirection(query.orderDirection);
    const orderSql = query.orderField
      ? `${field === 'consumed' ? 'consumed' : `c.${field}`} ${dir}, c.name ASC`
      : 'c.type DESC, c.name ASC';
    const page = pageClause(query);
    const data = await this.db.all<Category>(
      `SELECT c.id, c.name, c.description, c.type, c.color, c.icon, c.monthly_limit, c.created_at,
              COALESCE((SELECT SUM(m.amount) FROM movements m
                        WHERE m.category_id = c.id AND m.type = c.type AND m.deleted_at IS NULL
                          AND m.date >= ? AND m.date <= ?), 0) AS consumed
       FROM categories c WHERE ${whereSql} ORDER BY ${orderSql}${page.sql}`,
      [period.start, period.end, ...params, ...page.params],
    );
    return toPage(data, total, query);
  }

  findById(id: Uuid): Promise<Category | null> {
    return this.db.first<Category>(
      `SELECT id, name, description, type, color, icon, monthly_limit, created_at
       FROM categories WHERE id = ? AND family_id = ? AND deleted_at IS NULL`,
      [id, this.familyId()],
    );
  }

  findByName(type: TransactionType, name: string): Promise<Category | null> {
    return this.db.first<Category>(
      `SELECT id, name, description, type, color, icon, monthly_limit, created_at
       FROM categories WHERE family_id = ? AND type = ? AND lower(name) = lower(?) AND deleted_at IS NULL`,
      [this.familyId(), type, name.trim()],
    );
  }

  async create(ctx: WriteContext, data: CategoryData): Promise<Uuid> {
    const id = this.store.newId();
    const now = ctx.now();
    await ctx.tx.run(
      `INSERT INTO categories (id, family_id, name, description, type, color, icon, monthly_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, this.familyId(), data.name, data.description, data.type, data.color, data.icon, data.monthly_limit, now, now],
    );
    await ctx.markDirty('categories', id);
    return id;
  }

  async update(ctx: WriteContext, id: Uuid, data: CategoryData): Promise<void> {
    await ctx.tx.run(
      `UPDATE categories SET name = ?, description = ?, type = ?, color = ?, icon = ?, monthly_limit = ?, updated_at = ?
       WHERE id = ? AND family_id = ? AND deleted_at IS NULL`,
      [data.name, data.description, data.type, data.color, data.icon, data.monthly_limit, ctx.now(), id, this.familyId()],
    );
    await ctx.markDirty('categories', id);
  }

  async softDelete(ctx: WriteContext, id: Uuid): Promise<void> {
    const familyId = this.familyId();
    const now = ctx.now();
    // No servidor a FK é ON DELETE SET NULL, mas o soft delete não dispara FK: limpa aqui.
    for (const table of ['movements', 'fixed_expenses'] as const) {
      const ids = await ctx.markDirtyWhere(table, 'family_id = ? AND category_id = ? AND deleted_at IS NULL', [familyId, id]);
      if (ids.length) {
        await ctx.tx.run(
          `UPDATE ${table} SET category_id = NULL, updated_at = ? WHERE family_id = ? AND category_id = ? AND deleted_at IS NULL`,
          [now, familyId, id],
        );
      }
    }
    await ctx.tx.run('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND family_id = ?', [now, now, id, familyId]);
    await ctx.markDirty('categories', id);
  }
}
