import type { LocalStore } from '../db/localStore';
import { AppError } from '../errors/AppError';
import type { CategoryData, CategoryListQuery, CategoryRepository } from '../domain/repositories';
import type { Category, PaginatedResult, TransactionType, Uuid } from '../domain/types';
import { oneOf, optionalMoney, optionalText, requiredText } from './validation';

export interface CategoryInput {
  name: string;
  description?: string | null;
  type: TransactionType;
  color?: string | null;
  icon?: string | null;
  monthly_limit?: number | null;
}

function toData(input: CategoryInput): CategoryData {
  return {
    name: requiredText(input.name, 'Nome', 80),
    description: optionalText(input.description),
    type: oneOf(input.type, ['INCOME', 'EXPENSE'] as const, 'Tipo'),
    color: optionalText(input.color) ?? '#94a3b8',
    icon: optionalText(input.icon) ?? 'Tag',
    monthly_limit: optionalMoney(input.monthly_limit, 'Limite mensal'),
  };
}

async function assertUniqueName(repo: CategoryRepository, data: CategoryData, ignoreId?: Uuid) {
  const existing = await repo.findByName(data.type, data.name);
  if (existing && existing.id !== ignoreId) {
    throw new AppError('CONFLICT', `Já existe uma categoria "${existing.name}" deste tipo`, { field: 'name' });
  }
}

export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}
  execute(query: CategoryListQuery = {}): Promise<PaginatedResult<Category>> {
    return this.categories.list(query);
  }
}

export class GetCategory {
  constructor(private readonly categories: CategoryRepository) {}
  async execute(id: Uuid): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw AppError.notFound('Categoria', id);
    return category;
  }
}

export class CreateCategory {
  constructor(private readonly store: LocalStore, private readonly categories: CategoryRepository) {}
  async execute(input: CategoryInput): Promise<Uuid> {
    const data = toData(input);
    await assertUniqueName(this.categories, data);
    return this.store.write((ctx) => this.categories.create(ctx, data));
  }
}

export class UpdateCategory {
  constructor(private readonly store: LocalStore, private readonly categories: CategoryRepository) {}
  async execute(id: Uuid, input: CategoryInput): Promise<void> {
    if (!(await this.categories.findById(id))) throw AppError.notFound('Categoria', id);
    const data = toData(input);
    await assertUniqueName(this.categories, data, id);
    await this.store.write((ctx) => this.categories.update(ctx, id, data));
  }
}

export class DeleteCategory {
  constructor(private readonly store: LocalStore, private readonly categories: CategoryRepository) {}
  async execute(id: Uuid): Promise<void> {
    if (!(await this.categories.findById(id))) throw AppError.notFound('Categoria', id);
    await this.store.write((ctx) => this.categories.softDelete(ctx, id));
  }
}

/** Categorias padrão de uma família nova (mesmas da v1). Não faz nada se já houver categorias. */
export const DEFAULT_CATEGORIES: ReadonlyArray<[string, TransactionType, string, string]> = [
  ['Salário', 'INCOME', '#10b981', 'Wallet'],
  ['Freelance / Extra', 'INCOME', '#3b82f6', 'DollarSign'],
  ['Investimentos', 'INCOME', '#8b5cf6', 'TrendingUp'],
  ['Outras Receitas', 'INCOME', '#94a3b8', 'PlusCircle'],
  ['Moradia', 'EXPENSE', '#1e293b', 'Home'],
  ['Alimentação', 'EXPENSE', '#10b981', 'Utensils'],
  ['Transporte', 'EXPENSE', '#3b82f6', 'Car'],
  ['Lazer', 'EXPENSE', '#f59e0b', 'Smile'],
  ['Saúde', 'EXPENSE', '#ec4899', 'Heart'],
  ['Educação', 'EXPENSE', '#8b5cf6', 'BookOpen'],
  ['Investimentos', 'EXPENSE', '#8b5cf6', 'TrendingUp'],
  ['Empréstimos e Financiamentos', 'EXPENSE', '#ef4444', 'Landmark'],
  ['Compras e Eletrônicos', 'EXPENSE', '#f97316', 'ShoppingBag'],
  ['Assinaturas e Serviços', 'EXPENSE', '#06b6d4', 'Tv'],
  ['Cuidados Pessoais', 'EXPENSE', '#ec4899', 'Sparkles'],
  ['Vestuário e Calçados', 'EXPENSE', '#14b8a6', 'Shirt'],
  ['Cartão e Encargos', 'EXPENSE', '#a855f7', 'CreditCard'],
  ['Outras Despesas', 'EXPENSE', '#94a3b8', 'Tag'],
];

export class SeedDefaultCategories {
  constructor(private readonly store: LocalStore, private readonly categories: CategoryRepository) {}
  async execute(): Promise<number> {
    const existing = await this.categories.list({ perPage: 1 });
    if (existing.total > 0) return 0;
    await this.store.write(async (ctx) => {
      for (const [name, type, color, icon] of DEFAULT_CATEGORIES) {
        await this.categories.create(ctx, { name, type, color, icon, description: null, monthly_limit: null });
      }
    });
    return DEFAULT_CATEGORIES.length;
  }
}
