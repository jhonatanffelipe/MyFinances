import type { LocalStore, WriteContext } from '../db/localStore';
import { AppError } from '../errors/AppError';
import { fixedOccurrences } from '../domain/recurrence';
import type {
  CategoryRepository,
  CreditCardRepository,
  FamilyRepository,
  FixedExpenseData,
  FixedExpenseListQuery,
  FixedExpenseRepository,
  MovementRepository,
} from '../domain/repositories';
import type { FixedExpense, FixedExpenseRecurrence, PaginatedResult, TransactionType, Uuid } from '../domain/types';
import { dueDay, isoDate, oneOf, optionalText, positiveMoney, requiredText, yearMonth } from './validation';

const RECURRENCES = ['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const;

export interface FixedExpenseInput {
  description: string;
  amount: number;
  type?: TransactionType;
  member_id?: Uuid | null;
  category_id?: Uuid | null;
  credit_card_id?: Uuid | null;
  recurrence?: FixedExpenseRecurrence;
  due_day: number;
  start_date: string;
  end_date?: string | null;
  active?: boolean;
  notes?: string | null;
}

/** Valida o lançamento fixo contra categoria, cartão e membro da família. */
export class FixedExpenseValidator {
  constructor(
    private readonly store: LocalStore,
    private readonly families: FamilyRepository,
    private readonly categories: CategoryRepository,
    private readonly cards: CreditCardRepository,
  ) {}

  async validate(input: FixedExpenseInput): Promise<FixedExpenseData> {
    const type: TransactionType = input.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const start = isoDate(input.start_date, 'Data inicial');
    const end = input.end_date ? isoDate(input.end_date, 'Data final') : null;
    if (end && end < start) throw AppError.validation('Data final deve ser depois da inicial', { field: 'end_date' });

    const categoryId = input.category_id || null;
    if (categoryId && !(await this.categories.findById(categoryId))) {
      throw AppError.validation('Categoria não encontrada', { field: 'category_id' });
    }
    // Cartão de crédito só faz sentido em despesa
    const cardId = type === 'INCOME' ? null : input.credit_card_id || null;
    if (cardId && !(await this.cards.findById(cardId))) {
      throw AppError.validation('Cartão não encontrado', { field: 'credit_card_id' });
    }
    const memberId = input.member_id || null;
    if (memberId && !(await this.families.findActiveMember(this.store.session.current().familyId, memberId))) {
      throw new AppError('NOT_MEMBER', 'O responsável precisa ser um membro ativo da família', { field: 'member_id' });
    }

    return {
      member_id: memberId,
      description: requiredText(input.description, 'Descrição'),
      amount: positiveMoney(input.amount),
      type,
      category_id: categoryId,
      credit_card_id: cardId,
      recurrence: oneOf(input.recurrence ?? 'MONTHLY', RECURRENCES, 'Recorrência'),
      due_day: dueDay(input.due_day),
      start_date: start,
      end_date: end,
      active: input.active ?? true,
      notes: optionalText(input.notes),
    };
  }
}

/**
 * Gera um lançamento por ocorrência do período (só quando há data final, regra da v1).
 * Os lançamentos ficam no nome do responsável, ou de quem cadastrou.
 */
async function generateMovements(
  ctx: WriteContext,
  movements: MovementRepository,
  fixedId: Uuid,
  data: FixedExpenseData,
  defaultMember: Uuid,
) {
  if (!data.end_date) return;
  const notes = data.type === 'INCOME' ? 'Receita fixa automática' : 'Despesa fixa automática';
  const dates = fixedOccurrences({
    startDate: data.start_date,
    endDate: data.end_date,
    dueDay: data.due_day,
    recurrence: data.recurrence,
  });
  for (const date of dates) {
    await movements.create(ctx, {
      member_id: data.member_id ?? defaultMember,
      to_member_id: null,
      description: data.description,
      amount: data.amount,
      date,
      type: data.type,
      category_id: data.category_id,
      credit_card_id: data.credit_card_id,
      fixed_expense_id: fixedId,
      notes,
    });
  }
}

export class ListFixedExpenses {
  constructor(private readonly fixed: FixedExpenseRepository) {}
  execute(query: FixedExpenseListQuery = {}): Promise<PaginatedResult<FixedExpense>> {
    return this.fixed.list(query);
  }
}

export class GetFixedExpense {
  constructor(private readonly fixed: FixedExpenseRepository) {}
  async execute(id: Uuid): Promise<FixedExpense> {
    const item = await this.fixed.findById(id);
    if (!item) throw AppError.notFound('Lançamento fixo', id);
    return item;
  }
}

export class CreateFixedExpense {
  constructor(
    private readonly store: LocalStore,
    private readonly fixed: FixedExpenseRepository,
    private readonly movements: MovementRepository,
    private readonly validator: FixedExpenseValidator,
  ) {}
  async execute(input: FixedExpenseInput): Promise<Uuid> {
    const data = await this.validator.validate(input);
    const { userId } = this.store.session.current();
    return this.store.write(async (ctx) => {
      const id = await this.fixed.create(ctx, data);
      await generateMovements(ctx, this.movements, id, data, userId);
      return id;
    });
  }
}

/** Atualiza e regera os lançamentos automáticos (os antigos são excluídos logicamente). */
export class UpdateFixedExpense {
  constructor(
    private readonly store: LocalStore,
    private readonly fixed: FixedExpenseRepository,
    private readonly movements: MovementRepository,
    private readonly validator: FixedExpenseValidator,
  ) {}
  async execute(id: Uuid, input: FixedExpenseInput): Promise<void> {
    if (!(await this.fixed.findById(id))) throw AppError.notFound('Lançamento fixo', id);
    const data = await this.validator.validate(input);
    const { userId } = this.store.session.current();
    await this.store.write(async (ctx) => {
      await this.movements.softDeleteByFixedExpense(ctx, id);
      await this.fixed.update(ctx, id, data);
      await generateMovements(ctx, this.movements, id, data, userId);
    });
  }
}

export class DeleteFixedExpense {
  constructor(
    private readonly store: LocalStore,
    private readonly fixed: FixedExpenseRepository,
    private readonly movements: MovementRepository,
  ) {}
  async execute(id: Uuid): Promise<void> {
    if (!(await this.fixed.findById(id))) throw AppError.notFound('Lançamento fixo', id);
    await this.store.write(async (ctx) => {
      await this.movements.softDeleteByFixedExpense(ctx, id);
      await this.fixed.softDelete(ctx, id);
    });
  }
}

export class SetFixedExpensePaid {
  constructor(private readonly store: LocalStore, private readonly fixed: FixedExpenseRepository) {}
  async execute(id: Uuid, month: string, paid: boolean): Promise<void> {
    if (!(await this.fixed.findById(id))) throw AppError.notFound('Lançamento fixo', id);
    const ym = yearMonth(month);
    await this.store.write((ctx) => this.fixed.setPaid(ctx, id, ym, paid));
  }
}
