import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { getDatabase, persistDatabaseToDisk, queryObject, queryObjects } from '../database/index.js';

export function registerCreditCardsIpc() {
  ipcMain.handle(IPC_CHANNELS.CREDIT_CARDS_LIST, async (_event, params: any = {}) => {
    const { page = 0, perPage = 10, search = '', orderField = 'description', orderDirection = 'asc' } = params;
    const offset = page * perPage;
    const dir = orderDirection === 'desc' ? 'DESC' : 'ASC';
    const allowedOrder = ['description', 'due_day', 'active'].includes(orderField) ? orderField : 'description';
    const searchParam = search ? `%${search}%` : '%';

    const total = queryObject(
      `SELECT COUNT(*) as count FROM credit_cards WHERE description LIKE ?`,
      [searchParam]
    )?.count || 0;

    const data = queryObjects(
      `SELECT * FROM credit_cards WHERE description LIKE ? ORDER BY ${allowedOrder} ${dir} LIMIT ? OFFSET ?`,
      [searchParam, perPage, offset]
    );

    return { data, total, currentPage: page, perPage };
  });

  ipcMain.handle(IPC_CHANNELS.CREDIT_CARDS_CREATE, async (_event, card) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run('INSERT INTO credit_cards (description, color, due_day, active) VALUES (?, ?, ?, ?)', [
      card.description, card.color || '#8b5cf6', card.due_day, card.active ?? 1,
    ]);
    persistDatabaseToDisk();
    return queryObject('SELECT * FROM credit_cards ORDER BY id DESC LIMIT 1');
  });

  ipcMain.handle(IPC_CHANNELS.CREDIT_CARDS_UPDATE, async (_event, id, card) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run('UPDATE credit_cards SET description = ?, color = ?, due_day = ?, active = ? WHERE id = ?', [
      card.description, card.color, card.due_day, card.active ?? 1, id,
    ]);
    persistDatabaseToDisk();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CREDIT_CARDS_DELETE, async (_event, id) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run('UPDATE movements SET credit_card_id = NULL WHERE credit_card_id = ?', [id]);
    db.run('UPDATE fixed_expenses SET credit_card_id = NULL WHERE credit_card_id = ?', [id]);
    db.run('DELETE FROM credit_cards WHERE id = ?', [id]);
    persistDatabaseToDisk();
    return true;
  });
}
