import { getDb, mutate } from '../db';
import { parseAndAnalyzeImport } from '../../services/importParser';
import { ImportBankType, ImportParseResult, ImportPreviewItem } from '../../services/importTypes';

/**
 * Próxima data de vencimento do cartão a partir da data mais recente da fatura
 * (mesma regra do desktop: se o dia passou do vencimento, vence no mês seguinte).
 */
export function getNextCardDueDate(baseDateStr?: string, dueDay?: number): string {
  if (!dueDay || dueDay < 1 || dueDay > 31) {
    return baseDateStr || new Date().toISOString().slice(0, 10);
  }
  let year: number;
  let month: number;
  let day: number;
  if (baseDateStr && /^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
    [year, month, day] = baseDateStr.split('-').map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }
  if (day > dueDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const clampedDay = Math.min(dueDay, new Date(year, month, 0).getDate());
  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export interface ImportAnalysis extends ImportParseResult {
  /** Data aplicada aos lançamentos (vencimento do cartão), quando calculada. */
  invoiceDate: string | null;
}

/** Lê o CSV, sugere categorias, marca duplicidades e aplica a data de vencimento do cartão. */
export async function analyzeImport(
  content: string,
  options: { fileName?: string; creditCardId?: number | null; bankType?: ImportBankType } = {}
): Promise<ImportAnalysis> {
  const db = getDb();
  const snapshot = {
    categories: await db.all('SELECT id, name, type FROM categories'),
    movements: await db.all('SELECT id, description, amount, date, credit_card_id, fixed_expense_id FROM movements'),
    fixedExpenses: await db.all(
      "SELECT id, description, amount, due_day, active FROM fixed_expenses WHERE active = 1 AND COALESCE(type, 'EXPENSE') = 'EXPENSE'"
    ),
  };
  const result = parseAndAnalyzeImport(content, {
    creditCardId: options.creditCardId || null,
    fileName: options.fileName,
    bankType: options.bankType || 'AUTO',
    snapshot,
  });

  let invoiceDate: string | null = null;
  if (options.creditCardId) {
    const card = await db.first<{ due_day: number }>('SELECT due_day FROM credit_cards WHERE id = ?', [options.creditCardId]);
    const latest = result.items.map((i) => i.date).filter(Boolean).sort().pop();
    if (card?.due_day && latest) invoiceDate = getNextCardDueDate(latest, card.due_day);
  }
  if (!invoiceDate) {
    const fromName = (options.fileName || '').match(/(\d{4}-\d{2}-\d{2})/);
    if (fromName && options.creditCardId) invoiceDate = fromName[1];
  }
  if (invoiceDate) {
    for (const item of result.items) {
      item.originalDate = item.originalDate || item.date;
      item.date = invoiceDate;
    }
  }
  return { ...result, invoiceDate };
}

/** Grava os itens selecionados (mesmas notas do desktop) e retorna a quantidade importada. */
export async function executeImport(items: ImportPreviewItem[], creditCardId: number | null): Promise<number> {
  const selected = items.filter((i) => i.selected);
  if (selected.length === 0) throw new Error('Nenhum lançamento selecionado para importação');
  await mutate(async (tx) => {
    for (const item of selected) {
      let note = item.notes || (item.isInvoicePayment ? 'Pagamento de fatura importado' : 'Importado via fatura');
      if (item.originalDate && item.originalDate !== item.date) {
        const [y, m, d] = item.originalDate.split('-');
        note = `Compra realizada em ${d}/${m}/${y} | ${note}`;
      }
      await tx.run(
        `INSERT INTO movements (description, amount, date, type, category_id, credit_card_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.description, item.amount, item.date, item.type || 'EXPENSE', item.categoryId || null, creditCardId || null, note]
      );
    }
  });
  return selected.length;
}
