import type { LocalStore } from '../db/localStore';
import { AppError } from '../errors/AppError';
import type { CreditCardData, CreditCardListQuery, CreditCardRepository } from '../domain/repositories';
import type { CreditCard, PaginatedResult, Uuid } from '../domain/types';
import { dueDay, optionalText, requiredText } from './validation';

export interface CreditCardInput {
  description: string;
  color?: string | null;
  due_day: number;
  active?: boolean;
  owner_id?: Uuid | null;
}

function toData(input: CreditCardInput): CreditCardData {
  return {
    description: requiredText(input.description, 'Descrição', 80),
    color: optionalText(input.color) ?? '#8b5cf6',
    due_day: dueDay(input.due_day),
    active: input.active ?? true,
    owner_id: input.owner_id ?? null,
  };
}

export class ListCreditCards {
  constructor(private readonly cards: CreditCardRepository) {}
  execute(query: CreditCardListQuery = {}): Promise<PaginatedResult<CreditCard>> {
    return this.cards.list(query);
  }
}

export class GetCreditCard {
  constructor(private readonly cards: CreditCardRepository) {}
  async execute(id: Uuid): Promise<CreditCard> {
    const card = await this.cards.findById(id);
    if (!card) throw AppError.notFound('Cartão', id);
    return card;
  }
}

export class CreateCreditCard {
  constructor(private readonly store: LocalStore, private readonly cards: CreditCardRepository) {}
  execute(input: CreditCardInput): Promise<Uuid> {
    const data = toData(input);
    return this.store.write((ctx) => this.cards.create(ctx, data));
  }
}

export class UpdateCreditCard {
  constructor(private readonly store: LocalStore, private readonly cards: CreditCardRepository) {}
  async execute(id: Uuid, input: CreditCardInput): Promise<void> {
    if (!(await this.cards.findById(id))) throw AppError.notFound('Cartão', id);
    const data = toData(input);
    await this.store.write((ctx) => this.cards.update(ctx, id, data));
  }
}

/** Remove o cartão mantendo os lançamentos (ficam sem cartão), como na v1. */
export class DeleteCreditCard {
  constructor(private readonly store: LocalStore, private readonly cards: CreditCardRepository) {}
  async execute(id: Uuid): Promise<void> {
    if (!(await this.cards.findById(id))) throw AppError.notFound('Cartão', id);
    await this.store.write((ctx) => this.cards.softDelete(ctx, id));
  }
}
