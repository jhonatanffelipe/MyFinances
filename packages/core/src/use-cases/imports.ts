import type { Clock } from '../domain/ports';
import type { LocalStore } from '../db/localStore';
import { AppError } from '../errors/AppError';
import { nextCardDueDate } from '../domain/recurrence';
import type { CategoryRepository, CreditCardRepository, MovementRepository } from '../domain/repositories';
import type { Uuid } from '../domain/types';
import { parseAndAnalyzeImport } from '../services/importParser';
import type { ImportBankType, ImportParseResult, ImportPreviewItem } from '../services/importTypes';
import { isoDate, positiveMoney, requiredText } from './validation';

export interface ImportAnalysis extends ImportParseResult {
  /** Data aplicada aos lançamentos (vencimento do cartão), quando calculada. */
  invoiceDate: string | null;
  /** Itens que já foram importados antes (mesmo import_hash) e serão ignorados. */
  alreadyImportedCount: number;
}

/**
 * Lê o CSV, sugere categorias, marca duplicidades e aplica a data de vencimento
 * do cartão. Itens com `import_hash` já gravado vêm desmarcados e marcados como duplicados.
 */
export class AnalyzeImport {
  constructor(
    private readonly movements: MovementRepository,
    private readonly cards: CreditCardRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    content: string,
    options: { fileName?: string; creditCardId?: Uuid | null; bankType?: ImportBankType } = {},
  ): Promise<ImportAnalysis> {
    const card = options.creditCardId ? await this.cards.findById(options.creditCardId) : null;
    if (options.creditCardId && !card) throw AppError.validation('Cartão não encontrado', { field: 'creditCardId' });

    const result = parseAndAnalyzeImport(content, {
      creditCardId: card?.id ?? null,
      fileName: options.fileName,
      bankType: options.bankType || 'AUTO',
      snapshot: await this.movements.importSnapshot(),
    });

    const imported = await this.movements.existingImportHashes(result.items.map((i) => i.importHash));
    let alreadyImportedCount = 0;
    for (const item of result.items) {
      if (!imported.has(item.importHash)) continue;
      alreadyImportedCount++;
      item.selected = false;
      if (!item.potentialDuplicate.isDuplicate) result.duplicateCount++;
      item.potentialDuplicate = { ...item.potentialDuplicate, isDuplicate: true, reason: 'Já importado anteriormente' };
    }

    let invoiceDate: string | null = null;
    if (card) {
      const latest = result.items.map((i) => i.date).filter(Boolean).sort().pop();
      if (latest) invoiceDate = nextCardDueDate(latest, card.due_day, this.clock.today());
      const fromName = (options.fileName || '').match(/(\d{4}-\d{2}-\d{2})/);
      if (!invoiceDate && fromName) invoiceDate = fromName[1];
    }
    if (invoiceDate) {
      for (const item of result.items) {
        item.originalDate = item.originalDate || item.date;
        item.date = invoiceDate;
      }
    }
    return { ...result, invoiceDate, alreadyImportedCount };
  }
}

/** Grava os itens selecionados numa transação. Itens já importados são ignorados. */
export class ExecuteImport {
  constructor(
    private readonly store: LocalStore,
    private readonly movements: MovementRepository,
    private readonly categories: CategoryRepository,
    private readonly cards: CreditCardRepository,
  ) {}

  async execute(items: ImportPreviewItem[], creditCardId: Uuid | null): Promise<{ imported: number; skipped: number }> {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) throw AppError.validation('Nenhum lançamento selecionado para importação');
    if (creditCardId && !(await this.cards.findById(creditCardId))) {
      throw AppError.validation('Cartão não encontrado', { field: 'creditCardId' });
    }
    const validCategories = new Set((await this.categories.list({})).data.map((c) => c.id));
    const existing = await this.movements.existingImportHashes(selected.map((i) => i.importHash));
    const { userId } = this.store.session.current();

    let imported = 0;
    await this.store.write(async (ctx) => {
      for (const item of selected) {
        if (existing.has(item.importHash)) continue;
        existing.add(item.importHash);
        let note = item.notes || (item.isInvoicePayment ? 'Pagamento de fatura importado' : 'Importado via fatura');
        if (item.originalDate && item.originalDate !== item.date) {
          const [y, m, d] = item.originalDate.split('-');
          note = `Compra realizada em ${d}/${m}/${y} | ${note}`;
        }
        await this.movements.create(ctx, {
          member_id: userId,
          to_member_id: null,
          description: requiredText(item.description, 'Descrição'),
          amount: positiveMoney(item.amount),
          date: isoDate(item.date),
          type: item.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
          category_id: item.categoryId && validCategories.has(item.categoryId) ? item.categoryId : null,
          credit_card_id: creditCardId,
          notes: note,
          import_hash: item.importHash,
        });
        imported++;
      }
    });
    return { imported, skipped: selected.length - imported };
  }
}
