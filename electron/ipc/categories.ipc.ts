import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { getDatabase, persistDatabaseToDisk, queryObject, queryObjects } from '../database/index.js';
import { resolveYearMonth } from '../services/date.service.js';

export function registerCategoriesIpc() {
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_LIST, async (_event, params: any = {}) => {
    const { yearMonth, page = 0, perPage = 10, search = '', orderField = 'name', orderDirection = 'asc' } = params;
    const period = resolveYearMonth(yearMonth);
    const offset = page * perPage;
    const dir = orderDirection === 'desc' ? 'DESC' : 'ASC';
    const allowedOrder = ['name', 'type', 'monthly_limit', 'consumed'].includes(orderField) ? orderField : 'name';

    const searchParam = search ? `%${search}%` : '%';
    const baseParams = [period.start, period.end, searchParam];

    const total = queryObject(
      `SELECT COUNT(*) as count FROM categories c WHERE c.name LIKE ?`,
      [searchParam]
    )?.count || 0;

    const data = queryObjects(
      `SELECT c.*,
              COALESCE((
                SELECT SUM(m.amount) FROM movements m
                WHERE m.category_id = c.id AND m.type = 'EXPENSE'
                  AND m.date >= ? AND m.date <= ?
              ), 0) AS consumed
       FROM categories c
       WHERE c.name LIKE ?
       ORDER BY ${allowedOrder === 'consumed' ? 'consumed' : `c.${allowedOrder}`} ${dir}
       LIMIT ? OFFSET ?`,
      [...baseParams, perPage, offset]
    );

    return { data, total, currentPage: page, perPage };
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_CREATE, async (_event, cat) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run(
      'INSERT INTO categories (name, description, type, color, icon, monthly_limit) VALUES (?, ?, ?, ?, ?, ?)',
      [cat.name, cat.description || null, cat.type, cat.color || '#94a3b8', cat.icon || 'Tag', cat.monthly_limit ?? null]
    );
    persistDatabaseToDisk();
    return queryObject('SELECT * FROM categories ORDER BY id DESC LIMIT 1');
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_UPDATE, async (_event, id, cat) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run(
      'UPDATE categories SET name = ?, description = ?, type = ?, color = ?, icon = ?, monthly_limit = ? WHERE id = ?',
      [cat.name, cat.description || null, cat.type, cat.color, cat.icon, cat.monthly_limit ?? null, id]
    );
    persistDatabaseToDisk();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_DELETE, async (_event, id) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run('DELETE FROM categories WHERE id = ?', [id]);
    persistDatabaseToDisk();
    return true;
  });
}
