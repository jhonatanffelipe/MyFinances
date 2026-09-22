import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { getDatabase, persistDatabaseToDisk, queryObject, queryObjects } from '../database/index.js';
import { analyzeImportItems, parseNubankCsv } from '../services/importParser.service.js';
import { getMainWindow } from '../window.js';

export const MOVEMENT_SELECT = `
  SELECT m.*,
         c.name AS category_name, c.color AS category_color,
         cc.description AS credit_card_name, cc.color AS credit_card_color
  FROM movements m
  LEFT JOIN categories c ON m.category_id = c.id
  LEFT JOIN credit_cards cc ON m.credit_card_id = cc.id
`;

export function registerMovementsIpc() {
  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_LIST, async (_event, filters: any = {}) => {
    const {
      startDate, endDate, categoryId, creditCardId, type, search,
      page = 0, perPage = 25, orderField = 'date', orderDirection = 'desc',
    } = filters || {};

    const dir = orderDirection === 'desc' ? 'DESC' : 'ASC';
    const allowedOrder = ['date', 'amount', 'description', 'type'].includes(orderField) ? orderField : 'date';

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (startDate) { conditions.push('m.date >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('m.date <= ?'); params.push(endDate); }
    if (categoryId) { conditions.push('m.category_id = ?'); params.push(categoryId); }
    if (creditCardId) { conditions.push('m.credit_card_id = ?'); params.push(creditCardId); }
    if (type && type !== 'ALL') { conditions.push('m.type = ?'); params.push(type); }
    if (search) {
      conditions.push('(m.description LIKE ? OR m.notes LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    const countRow = queryObject(
      `SELECT COUNT(*) as count FROM movements m WHERE ${whereClause}`,
      params
    );
    const total = countRow?.count || 0;

    const summaryRow = queryObject(
      `SELECT 
         COALESCE(SUM(CASE WHEN m.type = 'INCOME' THEN m.amount ELSE 0 END), 0) as totalIncome,
         COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN m.amount ELSE 0 END), 0) as totalExpense,
         COALESCE(SUM(CASE WHEN m.type = 'INCOME' THEN 1 ELSE 0 END), 0) as incomeCount,
         COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN 1 ELSE 0 END), 0) as expenseCount
       FROM movements m WHERE ${whereClause}`,
      params
    );

    const offset = page * perPage;
    const data = queryObjects(
      `${MOVEMENT_SELECT} WHERE ${whereClause} ORDER BY m.${allowedOrder} ${dir}, m.id ${dir} LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    return {
      data,
      total,
      currentPage: page,
      perPage,
      summary: summaryRow || {
        totalIncome: 0,
        totalExpense: 0,
        incomeCount: 0,
        expenseCount: 0,
      },
    };
  });

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_CREATE, async (_event, mov) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run(
      'INSERT INTO movements (description, amount, date, type, category_id, credit_card_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [mov.description, mov.amount, mov.date, mov.type, mov.category_id, mov.credit_card_id || null, mov.notes || '']
    );
    persistDatabaseToDisk();
    return queryObject(`${MOVEMENT_SELECT} ORDER BY m.id DESC LIMIT 1`);
  });

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_UPDATE, async (_event, id, mov) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run(
      'UPDATE movements SET description = ?, amount = ?, date = ?, type = ?, category_id = ?, credit_card_id = ?, notes = ? WHERE id = ?',
      [mov.description, mov.amount, mov.date, mov.type, mov.category_id, mov.credit_card_id || null, mov.notes, id]
    );
    persistDatabaseToDisk();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_DELETE, async (_event, id) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    db.run('DELETE FROM movements WHERE id = ?', [id]);
    persistDatabaseToDisk();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_IMPORT_SELECT_FILE, async () => {
    const win = getMainWindow() ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return { success: false, error: 'Janela principal não encontrada' };

    const result = await dialog.showOpenDialog(win, {
      title: 'Selecione o arquivo CSV do Nubank (Extrato ou Fatura)',
      properties: ['openFile'],
      filters: [
        { name: 'Planilha CSV', extensions: ['csv'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Seleção cancelada pelo usuário' };
    }

    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      return { success: true, filePath, content, fileName };
    } catch (err: any) {
      return { success: false, error: `Falha ao ler o arquivo: ${err?.message || err}` };
    }
  });

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_IMPORT_PARSE, async (_event, params: any = {}) => {
    let content = params.content;
    let fileName = params.fileName || '';
    if (!content && params.filePath) {
      content = fs.readFileSync(params.filePath, 'utf8');
      fileName = path.basename(params.filePath);
    }
    if (!content) {
      throw new Error('Conteúdo do arquivo não fornecido para importação');
    }

    const rawItems = parseNubankCsv(content);
    const result = analyzeImportItems(rawItems, params.creditCardId || null, fileName);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_IMPORT_EXECUTE, async (_event, params: any) => {
    const db = getDatabase();
    if (!db) throw new Error('Banco de dados não inicializado');

    const items = params?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, importedCount: 0, error: 'Nenhum lançamento selecionado para importação' };
    }

    try {
      db.run('BEGIN TRANSACTION');
      for (const item of items) {
        db.run(
          `INSERT INTO movements (description, amount, date, type, category_id, credit_card_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            item.description,
            item.amount,
            item.date,
            item.type || 'EXPENSE',
            item.categoryId || null,
            item.creditCardId || null,
            item.notes || 'Importado via extrato Nubank',
          ]
        );
      }
      db.run('COMMIT');
      persistDatabaseToDisk();
      return { success: true, importedCount: items.length };
    } catch (err: any) {
      try {
        db.run('ROLLBACK');
      } catch (_) {}
      console.error('[Import] Erro ao executar importação em lote:', err);
      return { success: false, importedCount: 0, error: err?.message || 'Falha ao salvar lançamentos' };
    }
  });
}
