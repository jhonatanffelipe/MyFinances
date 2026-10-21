import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { getDatabase, persistDatabaseToDisk, queryObject, queryObjects } from '../database/index.js';
import { getMainWindow } from '../window.js';
import { parseAndAnalyzeImport } from '../services/importParser.service.js';

export const MOVEMENT_SELECT = `
  SELECT m.*,
         c.name AS category_name, c.color AS category_color,
         cc.description AS credit_card_name, cc.color AS credit_card_color,
         cc.due_day AS credit_card_due_day
  FROM movements m
  LEFT JOIN categories c ON m.category_id = c.id
  LEFT JOIN credit_cards cc ON m.credit_card_id = cc.id
`;

/** Calcula a data de vencimento (YYYY-MM-DD) do cartão no mês de referência. */
function formatCardDueDate(yearMonth: string, dueDay: number): string {
  let targetYm = yearMonth;
  if (!targetYm || !/^\d{4}-\d{2}$/.test(targetYm)) {
    const now = new Date();
    targetYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const [yStr, mStr] = targetYm.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const lastDay = new Date(y, m, 0).getDate();
  const clampedDay = Math.min(Math.max(dueDay || 1, 1), lastDay);
  return `${targetYm}-${String(clampedDay).padStart(2, '0')}`;
}

/** Valida e normaliza os parâmetros da exclusão em lote por cartão/mês. */
function parseBulkDeleteParams(params: any): { cardId: number; yearMonth: string } {
  const cardId = Number(params?.creditCardId);
  const yearMonth = String(params?.yearMonth || '');
  if (!Number.isInteger(cardId) || cardId <= 0) {
    throw new Error('Cartão inválido para exclusão em lote');
  }
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error('Mês inválido para exclusão em lote (esperado YYYY-MM)');
  }
  return { cardId, yearMonth };
}

// Mesmo critério do agrupamento de faturas na listagem: cartão + mês da data do lançamento
const BULK_DELETE_WHERE = 'credit_card_id = ? AND substr(date, 1, 7) = ?';

export function registerMovementsIpc() {
  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_LIST, async (_event, filters: any = {}) => {
    const {
      startDate, endDate, categoryId, creditCardId, type, search, excludeSearch,
      page = 0, perPage = 25, orderField = 'date', orderDirection = 'desc',
    } = filters || {};

    const dir = orderDirection === 'desc' ? 'DESC' : 'ASC';
    const allowedOrder = ['date', 'amount', 'description', 'type'].includes(orderField) ? orderField : 'date';

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (startDate) { conditions.push('m.date >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('m.date <= ?'); params.push(endDate); }
    if (categoryId) { conditions.push('m.category_id = ?'); params.push(categoryId); }

    // Identifica se o usuário quer ver os movimentos expandidos de um cartão específico
    const numericCardId =
      typeof creditCardId === 'number'
        ? creditCardId
        : typeof creditCardId === 'string' && /^\d+$/.test(creditCardId.trim())
          ? parseInt(creditCardId.trim(), 10)
          : null;

    const isSpecificCard = numericCardId !== null && numericCardId > 0;
    const isOnlyNonCard = creditCardId === 'none' || creditCardId === -1;
    const isAllUngrouped = creditCardId === 'all_ungrouped';
    const shouldGroup = !isSpecificCard && !isOnlyNonCard && !isAllUngrouped;

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

    const whereClause = conditions.join(' AND ');

    // Resumo de entradas e saídas
    const summaryRow = queryObject(
      `SELECT 
         COALESCE(SUM(CASE WHEN m.type = 'INCOME' THEN m.amount ELSE 0 END), 0) as totalIncome,
         COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN m.amount ELSE 0 END), 0) as totalExpense,
         COALESCE(SUM(CASE WHEN m.type = 'INCOME' THEN 1 ELSE 0 END), 0) as incomeCount,
         COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN 1 ELSE 0 END), 0) as expenseCount
       FROM movements m
       LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN credit_cards cc ON m.credit_card_id = cc.id
       WHERE ${whereClause}`,
      params
    );

    // MODO DETALHADO (Cartão específico selecionado, apenas dinheiro ou visão sem agrupamento)
    if (!shouldGroup) {
      const countRow = queryObject(
        `SELECT COUNT(*) as count
         FROM movements m
         LEFT JOIN categories c ON m.category_id = c.id
         LEFT JOIN credit_cards cc ON m.credit_card_id = cc.id
         WHERE ${whereClause}`,
        params
      );
      const total = countRow?.count || 0;
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
    }

    // MODO AGRUPADO (Padrão: agrupa lançamentos com cartão de crédito por fatura com data de vencimento)
    const allMatches = queryObjects(
      `${MOVEMENT_SELECT} WHERE ${whereClause} ORDER BY m.date ${dir}, m.id ${dir}`,
      params
    );

    const nonCardMovements: any[] = [];
    const cardGroupsMap = new Map<string, {
      cardId: number;
      cardName: string;
      cardColor: string;
      dueDay: number;
      yearMonth: string;
      items: any[];
    }>();

    for (const m of allMatches) {
      if (!m.credit_card_id) {
        nonCardMovements.push(m);
      } else {
        const ym = m.date && typeof m.date === 'string' && m.date.length >= 7
          ? m.date.substring(0, 7)
          : (startDate ? startDate.substring(0, 7) : new Date().toISOString().substring(0, 7));

        const groupKey = `${m.credit_card_id}_${ym}`;
        let group = cardGroupsMap.get(groupKey);
        if (!group) {
          group = {
            cardId: m.credit_card_id,
            cardName: m.credit_card_name || 'Cartão de Crédito',
            cardColor: m.credit_card_color || '#8b5cf6',
            dueDay: m.credit_card_due_day || 10,
            yearMonth: ym,
            items: [],
          };
          cardGroupsMap.set(groupKey, group);
        }
        group.items.push(m);
      }
    }

    const groupedCardRows: any[] = [];

    for (const group of cardGroupsMap.values()) {
      let netExpense = 0;
      for (const item of group.items) {
        if (item.type === 'EXPENSE') {
          netExpense += Number(item.amount);
        } else {
          netExpense -= Number(item.amount);
        }
      }

      const dueDate = formatCardDueDate(group.yearMonth, group.dueDay);
      const rowType = netExpense >= 0 ? 'EXPENSE' : 'INCOME';
      const finalAmount = Math.round(Math.abs(netExpense) * 100) / 100;

      if (type && type !== 'ALL' && type !== rowType) {
        continue;
      }

      // ID sintético único por cartão + mês (evita keys duplicadas no React quando o
      // período abrange várias faturas do mesmo cartão)
      const [gy, gm] = group.yearMonth.split('-').map((v) => parseInt(v, 10) || 0);
      groupedCardRows.push({
        id: -(group.cardId * 1000000 + gy * 100 + gm),
        groupKey: `${group.cardId}_${group.yearMonth}`,
        description: `Fatura - ${group.cardName}`,
        amount: finalAmount,
        date: dueDate,
        type: rowType,
        category_id: null,
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

    const combinedList = [...nonCardMovements, ...groupedCardRows];

    combinedList.sort((a, b) => {
      let cmp = 0;
      if (allowedOrder === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '');
      } else if (allowedOrder === 'amount') {
        cmp = Number(a.amount || 0) - Number(b.amount || 0);
      } else if (allowedOrder === 'description') {
        cmp = (a.description || '').localeCompare(b.description || '');
      } else if (allowedOrder === 'type') {
        cmp = (a.type || '').localeCompare(b.type || '');
      }
      return dir === 'DESC' ? -cmp : cmp;
    });

    const total = combinedList.length;
    const offset = page * perPage;
    const paginatedData = combinedList.slice(offset, offset + perPage);

    return {
      data: paginatedData,
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

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_BULK_DELETE_PREVIEW, async (_event, params: any) => {
    const { cardId, yearMonth } = parseBulkDeleteParams(params);
    const row = queryObject(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS totalExpense,
              COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) AS totalIncome,
              COALESCE(SUM(CASE WHEN fixed_expense_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS fixedCount
       FROM movements
       WHERE ${BULK_DELETE_WHERE}`,
      [cardId, yearMonth]
    );
    return {
      count: Number(row?.count || 0),
      totalExpense: Number(row?.totalExpense || 0),
      totalIncome: Number(row?.totalIncome || 0),
      fixedCount: Number(row?.fixedCount || 0),
    };
  });

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_BULK_DELETE, async (_event, params: any) => {
    const db = getDatabase();
    if (!db) throw new Error('Banco de dados não inicializado');

    const { cardId, yearMonth } = parseBulkDeleteParams(params);
    try {
      const countRow = queryObject(
        `SELECT COUNT(*) AS count FROM movements WHERE ${BULK_DELETE_WHERE}`,
        [cardId, yearMonth]
      );
      const deletedCount = Number(countRow?.count || 0);
      if (deletedCount === 0) {
        return { success: true, deletedCount: 0 };
      }

      db.run('BEGIN TRANSACTION');
      db.run(`DELETE FROM movements WHERE ${BULK_DELETE_WHERE}`, [cardId, yearMonth]);
      db.run('COMMIT');
      persistDatabaseToDisk();
      return { success: true, deletedCount };
    } catch (err: any) {
      try {
        db.run('ROLLBACK');
      } catch (_) {}
      console.error('[BulkDelete] Erro ao excluir lançamentos do cartão:', err);
      return { success: false, deletedCount: 0, error: err?.message || 'Falha ao excluir lançamentos' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.MOVEMENTS_IMPORT_SELECT_FILE, async () => {
    const win = getMainWindow() ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return { success: false, error: 'Janela principal não encontrada' };

    const result = await dialog.showOpenDialog(win, {
      title: 'Selecione o arquivo CSV da Fatura (Nubank ou Banco Inter)',
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

    const result = parseAndAnalyzeImport(content, {
      creditCardId: params.creditCardId || null,
      fileName,
      bankType: params.bankType || 'AUTO',
    });
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
