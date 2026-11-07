import type { LocalStore } from '../db/localStore';
import { AppError } from '../errors/AppError';
import { cardDueDate } from '../domain/recurrence';
import { roundMoney } from '../domain/money';
import type {
  BulkDeletePreview,
  CategoryRepository,
  CreditCardRepository,
  FamilyRepository,
  MovementData,
  MovementFilters,
  MovementListResult,
  MovementRepository,
} from '../domain/repositories';
import type { Movement, MovementType, Uuid } from '../domain/types';
import { isoDate, oneOf, optionalText, positiveMoney, requiredText, yearMonth } from './validation';

export interface MovementInput {
  description: string;
  amount: number;
  date: string;
  type: MovementType;
  /** De quem é o lançamento. Padrão: quem está logado. */
  member_id?: Uuid | null;
  /** Obrigatório em TRANSFER: quem recebe. */
  to_member_id?: Uuid | null;
  category_id?: Uuid | null;
  credit_card_id?: Uuid | null;
  notes?: string | null;
}

/**
 * Valida e normaliza um lançamento contra os dados da família:
 * membros ativos, categoria e cartão existentes, regras de transferência.
 */
export class MovementValidator {
  constructor(
    private readonly store: LocalStore,
    private readonly families: FamilyRepository,
    private readonly categories: CategoryRepository,
    private readonly cards: CreditCardRepository,
  ) {}

  async validate(input: MovementInput): Promise<MovementData> {
    const { familyId, userId } = this.store.session.current();
    const type = oneOf(input.type, ['INCOME', 'EXPENSE', 'TRANSFER'] as const, 'Tipo');
    const memberId = input.member_id || userId;
    if (!(await this.families.findActiveMember(familyId, memberId))) {
      throw new AppError('NOT_MEMBER', 'O lançamento precisa ser de um membro ativo da família', { field: 'member_id' });
    }

    let toMemberId: Uuid | null = null;
    let categoryId: Uuid | null = input.category_id || null;
    let cardId: Uuid | null = input.credit_card_id || null;

    if (type === 'TRANSFER') {
      toMemberId = input.to_member_id || null;
      if (!toMemberId) throw AppError.validation('Informe quem recebe a transferência', { field: 'to_member_id' });
      if (toMemberId === memberId) throw AppError.validation('Transferência precisa ser para outro membro', { field: 'to_member_id' });
      if (!(await this.families.findActiveMember(familyId, toMemberId))) {
        throw new AppError('NOT_MEMBER', 'Quem recebe precisa ser um membro ativo da família', { field: 'to_member_id' });
      }
      // Transferência não é receita nem despesa: sem categoria e sem cartão
      categoryId = null;
      cardId = null;
    }

    if (categoryId && !(await this.categories.findById(categoryId))) {
      throw AppError.validation('Categoria não encontrada', { field: 'category_id' });
    }
    if (cardId && !(await this.cards.findById(cardId))) {
      throw AppError.validation('Cartão não encontrado', { field: 'credit_card_id' });
    }

    return {
      member_id: memberId,
      to_member_id: toMemberId,
      description: requiredText(input.description, 'Descrição'),
      amount: positiveMoney(input.amount),
      date: isoDate(input.date),
      type,
      category_id: categoryId,
      credit_card_id: cardId,
      notes: optionalText(input.notes),
    };
  }
}

/**
 * Lista lançamentos do período. Por padrão agrupa os de cartão numa linha
 * "Fatura" por cartão + mês (regra da v1). Com um cartão específico, 'none' ou
 * 'all_ungrouped', devolve os itens detalhados (paginados no SQL).
 */
export class ListMovements {
  constructor(private readonly movements: MovementRepository) {}

  async execute(filters: MovementFilters = {}): Promise<MovementListResult> {
    const page = Math.max(0, filters.page ?? 0);
    const summary = await this.movements.summary(filters);
    const shouldGroup = !filters.creditCardId;

    if (!shouldGroup) {
      const [data, total] = await Promise.all([this.movements.findMany(filters), this.movements.count(filters)]);
      return { data, total, currentPage: page, perPage: filters.perPage || total, summary };
    }

    const all = await this.movements.findMany({ ...filters, page: undefined, perPage: undefined });
    const rows = groupCardInvoices(all, filters);
    const total = rows.length;
    const data = filters.perPage ? rows.slice(page * filters.perPage, (page + 1) * filters.perPage) : rows;
    return { data, total, currentPage: page, perPage: filters.perPage || total, summary };
  }
}

/** Agrupa lançamentos de cartão em faturas (cartão + mês) e ordena junto com os demais. */
export function groupCardInvoices(rows: Movement[], filters: MovementFilters): Movement[] {
  const loose: Movement[] = [];
  const groups = new Map<string, { cardId: Uuid; name: string; color: string; dueDay: number; yearMonth: string; items: Movement[] }>();

  for (const m of rows) {
    if (!m.credit_card_id) {
      loose.push(m);
      continue;
    }
    const ym = m.date.substring(0, 7);
    const key = `${m.credit_card_id}_${ym}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        cardId: m.credit_card_id,
        name: m.credit_card_name || 'Cartão de Crédito',
        color: m.credit_card_color || '#8b5cf6',
        dueDay: Number(m.credit_card_due_day) || 10,
        yearMonth: ym,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(m);
  }

  const invoices: Movement[] = [];
  for (const g of groups.values()) {
    const net = g.items.reduce((acc, i) => acc + (i.type === 'EXPENSE' ? Number(i.amount) : -Number(i.amount)), 0);
    const type: MovementType = net >= 0 ? 'EXPENSE' : 'INCOME';
    if (filters.type && filters.type !== 'ALL' && filters.type !== type) continue;
    const first = g.items[0];
    invoices.push({
      id: `invoice_${g.cardId}_${g.yearMonth}`,
      groupKey: `${g.cardId}_${g.yearMonth}`,
      member_id: first.member_id,
      to_member_id: null,
      created_by: first.created_by,
      description: `Fatura - ${g.name}`,
      amount: roundMoney(Math.abs(net)),
      date: cardDueDate(g.yearMonth, g.dueDay),
      type,
      category_id: null,
      category_name: 'Fatura de Cartão',
      category_color: g.color,
      credit_card_id: g.cardId,
      credit_card_name: g.name,
      credit_card_color: g.color,
      fixed_expense_id: null,
      notes: `${g.items.length} lançamento(s) agrupado(s) nesta fatura`,
      import_hash: null,
      created_at: first.created_at,
      updated_at: first.updated_at,
      isGroupedCard: true,
      cardMovementCount: g.items.length,
      cardMovements: g.items,
    });
  }

  const field = filters.orderField ?? 'date';
  const dir = (filters.orderDirection ?? 'desc') === 'desc' ? -1 : 1;
  const compare = (a: Movement, b: Movement) => {
    switch (field) {
      case 'amount':
        return Number(a.amount) - Number(b.amount);
      case 'description':
        return a.description.localeCompare(b.description);
      case 'type':
        return a.type.localeCompare(b.type);
      default:
        return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
    }
  };
  return [...loose, ...invoices].sort((a, b) => dir * compare(a, b));
}

export class GetMovement {
  constructor(private readonly movements: MovementRepository) {}
  async execute(id: Uuid): Promise<Movement> {
    const movement = await this.movements.findById(id);
    if (!movement) throw AppError.notFound('Lançamento', id);
    return movement;
  }
}

export class CreateMovement {
  constructor(
    private readonly store: LocalStore,
    private readonly movements: MovementRepository,
    private readonly validator: MovementValidator,
  ) {}
  async execute(input: MovementInput): Promise<Uuid> {
    const data = await this.validator.validate(input);
    return this.store.write((ctx) => this.movements.create(ctx, data));
  }
}

export class UpdateMovement {
  constructor(
    private readonly store: LocalStore,
    private readonly movements: MovementRepository,
    private readonly validator: MovementValidator,
  ) {}
  async execute(id: Uuid, input: MovementInput): Promise<void> {
    if (!(await this.movements.findById(id))) throw AppError.notFound('Lançamento', id);
    const data = await this.validator.validate(input);
    await this.store.write((ctx) => this.movements.update(ctx, id, data));
  }
}

export class DeleteMovement {
  constructor(private readonly store: LocalStore, private readonly movements: MovementRepository) {}
  async execute(id: Uuid): Promise<void> {
    if (!(await this.movements.findById(id))) throw AppError.notFound('Lançamento', id);
    await this.store.write((ctx) => this.movements.softDelete(ctx, id));
  }
}

export class PreviewBulkDeleteCard {
  constructor(private readonly movements: MovementRepository, private readonly cards: CreditCardRepository) {}
  async execute(creditCardId: Uuid, month: string): Promise<BulkDeletePreview> {
    if (!(await this.cards.findById(creditCardId))) throw AppError.validation('Cartão inválido', { field: 'creditCardId' });
    return this.movements.previewDeleteByCardMonth(creditCardId, yearMonth(month));
  }
}

/** Exclui todos os lançamentos de um cartão no mês (mesmo critério do agrupamento de faturas). */
export class BulkDeleteCard {
  constructor(
    private readonly store: LocalStore,
    private readonly movements: MovementRepository,
    private readonly cards: CreditCardRepository,
  ) {}
  async execute(creditCardId: Uuid, month: string): Promise<number> {
    if (!(await this.cards.findById(creditCardId))) throw AppError.validation('Cartão inválido', { field: 'creditCardId' });
    const ym = yearMonth(month);
    return this.store.write((ctx) => this.movements.softDeleteByCardMonth(ctx, creditCardId, ym));
  }
}
