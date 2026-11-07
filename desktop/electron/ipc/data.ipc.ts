import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { Category, CreditCard, FixedExpense, ImportPreviewItem, Movement } from '@myfinances/core';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge';
import type { AppController } from '../app/appController';
import { handle } from '../app/ipcHelpers';
import { getMainWindow } from '../window';

/**
 * Handlers de dados da v1 (mesmos canais), agora sobre os use cases do core.
 * O renderer ainda usa 0/1 em `active` e `paid`; a conversão fica aqui.
 */
const cardView = (c: CreditCard) => ({ ...c, active: c.active ? 1 : 0 });
const fixedView = (f: FixedExpense) => ({ ...f, active: f.active ? 1 : 0, paid: f.paid ? 1 : 0 });
const movementView = (m: Movement): Movement => ({
  ...m,
  cardMovements: m.cardMovements?.map(movementView),
});

const flag = (v: unknown, fallback = true) => (v === undefined || v === null ? fallback : v === true || Number(v) === 1);
const nullableId = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

/** O filtro de cartão da v1 aceitava número/-1; agora é uuid, 'none' ou 'all_ungrouped'. */
function cardFilter(v: unknown) {
  if (v === -1 || v === '-1' || v === 'none') return 'none';
  if (v === 'all_ungrouped') return 'all_ungrouped';
  return nullableId(v) ?? undefined;
}

export function registerDataIpc(controller: AppController) {
  const core = () => controller.core();

  // ---------------------------------------------------------------- categorias
  handle(IPC_CHANNELS.CATEGORIES_LIST, async (params: any = {}) => {
    const result = await core().categories.list.execute({
      yearMonth: params.yearMonth,
      type: params.type,
      search: params.search,
      page: params.page ?? 0,
      perPage: params.perPage ?? 10,
      orderField: params.orderField,
      orderDirection: params.orderDirection,
    });
    return result;
  });
  handle(IPC_CHANNELS.CATEGORIES_CREATE, async (cat: Partial<Category>) => {
    const id = await core().categories.create.execute(cat as any);
    return { ...cat, id };
  });
  handle(IPC_CHANNELS.CATEGORIES_UPDATE, async (id: string, cat: Partial<Category>) => {
    await core().categories.update.execute(id, cat as any);
    return true;
  });
  handle(IPC_CHANNELS.CATEGORIES_DELETE, async (id: string) => {
    await core().categories.remove.execute(id);
    return true;
  });

  // ---------------------------------------------------------------- cartões
  handle(IPC_CHANNELS.CREDIT_CARDS_LIST, async (params: any = {}) => {
    const result = await core().creditCards.list.execute({
      search: params.search,
      page: params.page ?? 0,
      perPage: params.perPage ?? 10,
      orderField: params.orderField,
      orderDirection: params.orderDirection,
    });
    return { ...result, data: result.data.map(cardView) };
  });
  handle(IPC_CHANNELS.CREDIT_CARDS_CREATE, async (card: any) => {
    const id = await core().creditCards.create.execute({ ...card, active: flag(card.active), owner_id: nullableId(card.owner_id) });
    return { ...card, id };
  });
  handle(IPC_CHANNELS.CREDIT_CARDS_UPDATE, async (id: string, card: any) => {
    await core().creditCards.update.execute(id, { ...card, active: flag(card.active), owner_id: nullableId(card.owner_id) });
    return true;
  });
  handle(IPC_CHANNELS.CREDIT_CARDS_DELETE, async (id: string) => {
    await core().creditCards.remove.execute(id);
    return true;
  });

  // ---------------------------------------------------------------- lançamentos
  handle(IPC_CHANNELS.MOVEMENTS_LIST, async (filters: any = {}) => {
    const result = await core().movements.list.execute({
      startDate: filters.startDate,
      endDate: filters.endDate,
      categoryId: nullableId(filters.categoryId) ?? undefined,
      creditCardId: cardFilter(filters.creditCardId),
      type: filters.type,
      memberId: nullableId(filters.memberId) ?? undefined,
      search: filters.search,
      excludeSearch: filters.excludeSearch,
      page: filters.page ?? 0,
      perPage: filters.perPage ?? 25,
      orderField: filters.orderField,
      orderDirection: filters.orderDirection,
    });
    return { ...result, data: result.data.map(movementView) };
  });

  const movementInput = (m: any) => ({
    description: m.description,
    amount: Number(m.amount),
    date: m.date,
    type: m.type,
    member_id: nullableId(m.member_id),
    to_member_id: nullableId(m.to_member_id),
    category_id: nullableId(m.category_id),
    credit_card_id: nullableId(m.credit_card_id),
    notes: m.notes ?? null,
  });
  handle(IPC_CHANNELS.MOVEMENTS_CREATE, async (m: any) => {
    const id = await core().movements.create.execute(movementInput(m));
    return core().movements.get.execute(id);
  });
  handle(IPC_CHANNELS.MOVEMENTS_UPDATE, async (id: string, m: any) => {
    await core().movements.update.execute(id, movementInput(m));
    return true;
  });
  handle(IPC_CHANNELS.MOVEMENTS_DELETE, async (id: string) => {
    await core().movements.remove.execute(id);
    return true;
  });
  handle(IPC_CHANNELS.MOVEMENTS_BULK_DELETE_PREVIEW, async (p: any) =>
    core().movements.previewBulkDeleteCard.execute(String(p?.creditCardId ?? ''), String(p?.yearMonth ?? '')),
  );
  handle(IPC_CHANNELS.MOVEMENTS_BULK_DELETE, async (p: any) => {
    const deletedCount = await core().movements.bulkDeleteCard.execute(String(p?.creditCardId ?? ''), String(p?.yearMonth ?? ''));
    return { success: true, deletedCount };
  });

  // ---------------------------------------------------------------- importação
  handle(IPC_CHANNELS.MOVEMENTS_IMPORT_SELECT_FILE, async () => {
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
    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Seleção cancelada pelo usuário' };
    const filePath = result.filePaths[0];
    try {
      return { success: true, filePath, content: fs.readFileSync(filePath, 'utf8'), fileName: path.basename(filePath) };
    } catch (err: any) {
      return { success: false, error: `Falha ao ler o arquivo: ${err?.message || err}` };
    }
  });

  handle(IPC_CHANNELS.MOVEMENTS_IMPORT_PARSE, async (params: any = {}) => {
    let content: string | undefined = params.content;
    let fileName: string = params.fileName || '';
    if (!content && params.filePath) {
      content = fs.readFileSync(params.filePath, 'utf8');
      fileName = path.basename(params.filePath);
    }
    if (!content) throw new Error('Conteúdo do arquivo não fornecido para importação');
    return core().movements.analyzeImport.execute(content, {
      fileName,
      creditCardId: nullableId(params.creditCardId),
      bankType: params.bankType || 'AUTO',
    });
  });

  /** O renderer já monta a nota final (com a data original); aqui só grava. */
  handle(IPC_CHANNELS.MOVEMENTS_IMPORT_EXECUTE, async (params: any) => {
    const items: any[] = params?.items ?? [];
    if (items.length === 0) return { success: false, importedCount: 0, error: 'Nenhum lançamento selecionado para importação' };
    const byCard = new Map<string | null, ImportPreviewItem[]>();
    for (const item of items) {
      const cardId = nullableId(item.creditCardId);
      const preview: ImportPreviewItem = {
        id: item.importHash,
        importHash: item.importHash,
        date: item.date,
        description: item.description,
        amount: Number(item.amount),
        type: item.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        categoryId: nullableId(item.categoryId),
        creditCardId: cardId,
        isInvoicePayment: false,
        notes: item.notes,
        potentialDuplicate: { isDuplicate: false },
        selected: true,
      };
      byCard.set(cardId, [...(byCard.get(cardId) ?? []), preview]);
    }
    let importedCount = 0;
    let skipped = 0;
    for (const [cardId, group] of byCard) {
      const r = await core().movements.executeImport.execute(group, cardId);
      importedCount += r.imported;
      skipped += r.skipped;
    }
    return { success: true, importedCount, skippedCount: skipped };
  });

  // ---------------------------------------------------------------- lançamentos fixos
  handle(IPC_CHANNELS.FIXED_EXPENSES_LIST, async (params: any = {}) => {
    const result = await core().fixedExpenses.list.execute({
      type: params.type,
      yearMonth: params.yearMonth,
      search: params.search,
      page: params.page ?? 0,
      perPage: params.perPage ?? 10,
      orderField: params.orderField,
      orderDirection: params.orderDirection,
    });
    return { ...result, data: result.data.map(fixedView) };
  });
  const fixedInput = (f: any) => ({
    description: f.description,
    amount: Number(f.amount),
    type: f.type,
    member_id: nullableId(f.member_id),
    category_id: nullableId(f.category_id),
    credit_card_id: nullableId(f.credit_card_id),
    recurrence: f.recurrence,
    due_day: Number(f.due_day),
    start_date: f.start_date,
    end_date: f.end_date || null,
    active: flag(f.active),
    notes: f.notes ?? null,
  });
  handle(IPC_CHANNELS.FIXED_EXPENSES_CREATE, async (f: any) => {
    const id = await core().fixedExpenses.create.execute(fixedInput(f));
    return { ...f, id };
  });
  handle(IPC_CHANNELS.FIXED_EXPENSES_UPDATE, async (id: string, f: any) => {
    await core().fixedExpenses.update.execute(id, fixedInput(f));
    return true;
  });
  handle(IPC_CHANNELS.FIXED_EXPENSES_DELETE, async (id: string) => {
    await core().fixedExpenses.remove.execute(id);
    return true;
  });
  handle(IPC_CHANNELS.FIXED_EXPENSES_TOGGLE_PAID, async (id: string, yearMonth: string, paid: boolean) => {
    await core().fixedExpenses.setPaid.execute(id, yearMonth, paid);
    return true;
  });

  // ---------------------------------------------------------------- dashboard
  handle(IPC_CHANNELS.DASHBOARD_GET_DATA, async (yearMonth?: string) => {
    const data = await core().dashboard.get.execute(yearMonth);
    return { ...data, upcomingFixedExpenses: data.upcomingFixedExpenses.map((f) => ({ ...fixedView(f), formattedDueDate: f.formattedDueDate })) };
  });
}
