import { getDb, mutate } from '../db';
import { SqlParam } from '../adapter';
import { resolveYearMonth } from '../date';
import { Category, TransactionType } from '../types';

export type CategoryInput = {
  name: string;
  description?: string | null;
  type: TransactionType;
  color?: string;
  icon?: string;
  monthly_limit?: number | null;
};

/** Lista categorias com o total consumido no mês (movimentos do mesmo tipo). */
export async function listCategories(params: { yearMonth?: string; type?: TransactionType | 'ALL'; search?: string } = {}) {
  const period = resolveYearMonth(params.yearMonth);
  const args: SqlParam[] = [period.start, period.end, params.search ? `%${params.search}%` : '%'];
  let sql = `SELECT c.*,
       COALESCE((
         SELECT SUM(m.amount) FROM movements m
         WHERE m.category_id = c.id AND m.type = c.type AND m.date >= ? AND m.date <= ?
       ), 0) AS consumed
     FROM categories c
     WHERE c.name LIKE ?`;
  if (params.type && params.type !== 'ALL') {
    sql += ' AND c.type = ?';
    args.push(params.type);
  }
  sql += ' ORDER BY c.type DESC, c.name ASC';
  return getDb().all<Category>(sql, args);
}

export async function getCategory(id: number) {
  return getDb().first<Category>('SELECT * FROM categories WHERE id = ?', [id]);
}

export async function createCategory(cat: CategoryInput) {
  return mutate(async (tx) => {
    const res = await tx.run(
      'INSERT INTO categories (name, description, type, color, icon, monthly_limit) VALUES (?, ?, ?, ?, ?, ?)',
      [cat.name, cat.description || null, cat.type, cat.color || '#94a3b8', cat.icon || 'Tag', cat.monthly_limit ?? null]
    );
    return res.lastInsertRowId;
  });
}

export async function updateCategory(id: number, cat: CategoryInput) {
  await mutate((tx) =>
    tx.run(
      'UPDATE categories SET name = ?, description = ?, type = ?, color = ?, icon = ?, monthly_limit = ? WHERE id = ?',
      [cat.name, cat.description || null, cat.type, cat.color || '#94a3b8', cat.icon || 'Tag', cat.monthly_limit ?? null, id]
    )
  );
}

export async function deleteCategory(id: number) {
  await mutate((tx) => tx.run('DELETE FROM categories WHERE id = ?', [id]));
}
