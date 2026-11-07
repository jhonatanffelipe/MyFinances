import type { WriteContext } from '../db/localStore';
import type {
  Category,
  CreditCard,
  Family,
  FamilyMember,
  FixedExpense,
  FixedExpenseRecurrence,
  Movement,
  MovementSummary,
  MovementType,
  PageRequest,
  PaginatedResult,
  TransactionType,
  Uuid,
} from './types';

/**
 * Contratos de acesso a dados. Os use cases dependem só destas interfaces;
 * a implementação atual é SQLite local (repositories/sqlite).
 *
 * Leituras usam a família da sessão. Escritas recebem o `WriteContext` da
 * transação, para que um use case combine vários repositórios numa unidade
 * de trabalho só (e tudo vá junto para o outbox).
 */

// ---------- Família ----------
export interface FamilyRepository {
  listFamilies(): Promise<Family[]>;
  listMembers(familyId: Uuid, options?: { onlyActive?: boolean }): Promise<FamilyMember[]>;
  findActiveMember(familyId: Uuid, userId: Uuid): Promise<FamilyMember | null>;
  /** Grava o que veio do servidor (pull). Não passa pelo outbox. */
  upsertFamily(ctx: WriteContext, family: Family): Promise<void>;
  replaceMembers(ctx: WriteContext, familyId: Uuid, members: FamilyMember[]): Promise<void>;
}

// ---------- Categorias ----------
export interface CategoryData {
  name: string;
  description: string | null;
  type: TransactionType;
  color: string;
  icon: string;
  monthly_limit: number | null;
}

export type CategoryOrderField = 'name' | 'type' | 'monthly_limit' | 'consumed';

export interface CategoryListQuery extends PageRequest<CategoryOrderField> {
  yearMonth?: string;
  type?: TransactionType | 'ALL';
  search?: string;
}

export interface CategoryRepository {
  list(query: CategoryListQuery): Promise<PaginatedResult<Category>>;
  findById(id: Uuid): Promise<Category | null>;
  findByName(type: TransactionType, name: string): Promise<Category | null>;
  create(ctx: WriteContext, data: CategoryData): Promise<Uuid>;
  update(ctx: WriteContext, id: Uuid, data: CategoryData): Promise<void>;
  /** Exclusão lógica; lançamentos e fixos que usavam a categoria ficam sem categoria. */
  softDelete(ctx: WriteContext, id: Uuid): Promise<void>;
}

// ---------- Cartões ----------
export interface CreditCardData {
  description: string;
  color: string;
  due_day: number;
  active: boolean;
  owner_id: Uuid | null;
}

export type CreditCardOrderField = 'description' | 'due_day' | 'active';

export interface CreditCardListQuery extends PageRequest<CreditCardOrderField> {
  search?: string;
  onlyActive?: boolean;
}

export interface CreditCardRepository {
  list(query: CreditCardListQuery): Promise<PaginatedResult<CreditCard>>;
  findById(id: Uuid): Promise<CreditCard | null>;
  create(ctx: WriteContext, data: CreditCardData): Promise<Uuid>;
  update(ctx: WriteContext, id: Uuid, data: CreditCardData): Promise<void>;
  /** Exclusão lógica; lançamentos e fixos do cartão continuam, sem cartão. */
  softDelete(ctx: WriteContext, id: Uuid): Promise<void>;
}

// ---------- Lançamentos ----------
export interface MovementData {
  member_id: Uuid;
  to_member_id: Uuid | null;
  description: string;
  amount: number;
  date: string;
  type: MovementType;
  category_id: Uuid | null;
  credit_card_id: Uuid | null;
  fixed_expense_id?: Uuid | null;
  notes: string | null;
  import_hash?: string | null;
}

export type MovementOrderField = 'date' | 'amount' | 'description' | 'type';

export interface MovementFilters extends PageRequest<MovementOrderField> {
  startDate?: string;
  endDate?: string;
  categoryId?: Uuid;
  /** uuid do cartão, 'none' (sem cartão) ou 'all_ungrouped' (sem agrupar faturas). */
  creditCardId?: Uuid | 'none' | 'all_ungrouped';
  type?: MovementType | 'ALL';
  /** Só lançamentos deste membro (inclui transferências em que ele envia ou recebe). */
  memberId?: Uuid;
  search?: string;
  excludeSearch?: string;
}

export interface MovementListResult extends PaginatedResult<Movement> {
  summary: MovementSummary;
}

export interface BulkDeletePreview {
  count: number;
  totalExpense: number;
  totalIncome: number;
  fixedCount: number;
  /** De quem são os lançamentos (todos editam tudo: a confirmação mostra o dono). */
  members: Array<{ member_id: Uuid; name: string | null; count: number }>;
}

export interface MovementRepository {
  /** Lançamentos detalhados (sem agrupar faturas), já com nomes de categoria, cartão e membros. */
  findMany(filters: MovementFilters): Promise<Movement[]>;
  count(filters: MovementFilters): Promise<number>;
  summary(filters: MovementFilters): Promise<MovementSummary>;
  findById(id: Uuid): Promise<Movement | null>;
  existingImportHashes(hashes: string[]): Promise<Set<string>>;
  create(ctx: WriteContext, data: MovementData): Promise<Uuid>;
  update(ctx: WriteContext, id: Uuid, data: MovementData): Promise<void>;
  softDelete(ctx: WriteContext, id: Uuid): Promise<void>;
  previewDeleteByCardMonth(cardId: Uuid, yearMonth: string): Promise<BulkDeletePreview>;
  softDeleteByCardMonth(ctx: WriteContext, cardId: Uuid, yearMonth: string): Promise<number>;
  softDeleteByFixedExpense(ctx: WriteContext, fixedExpenseId: Uuid): Promise<number>;
  /** Dados usados pelo parser de importação para sugerir categoria e marcar duplicidade. */
  importSnapshot(): Promise<{
    categories: Array<{ id: Uuid; name: string; type: TransactionType }>;
    movements: Array<{ id: Uuid; description: string; amount: number; date: string; credit_card_id: Uuid | null; fixed_expense_id: Uuid | null }>;
    fixedExpenses: Array<{ id: Uuid; description: string; amount: number; due_day: number; active: number }>;
  }>;
}

// ---------- Lançamentos fixos ----------
export interface FixedExpenseData {
  member_id: Uuid | null;
  description: string;
  amount: number;
  type: TransactionType;
  category_id: Uuid | null;
  credit_card_id: Uuid | null;
  recurrence: FixedExpenseRecurrence;
  due_day: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
}

export type FixedExpenseOrderField = 'due_day' | 'description' | 'amount';

export interface FixedExpenseListQuery extends PageRequest<FixedExpenseOrderField> {
  type?: TransactionType;
  yearMonth?: string;
  search?: string;
}

export interface FixedExpenseRepository {
  list(query: FixedExpenseListQuery): Promise<PaginatedResult<FixedExpense>>;
  findById(id: Uuid): Promise<FixedExpense | null>;
  create(ctx: WriteContext, data: FixedExpenseData): Promise<Uuid>;
  update(ctx: WriteContext, id: Uuid, data: FixedExpenseData): Promise<void>;
  softDelete(ctx: WriteContext, id: Uuid): Promise<void>;
  setPaid(ctx: WriteContext, id: Uuid, yearMonth: string, paid: boolean): Promise<void>;
}

// ---------- Dashboard (somente leitura) ----------
export interface PeriodTotals {
  income: number;
  expense: number;
}

export interface DashboardQueries {
  balanceUntil(date: string): Promise<number>;
  totals(start: string, end: string): Promise<PeriodTotals>;
  fixedExpensesTotal(start: string, end: string): Promise<number>;
  expensesByCategory(start: string, end: string): Promise<Array<{ id: Uuid; label: string; value: number; color: string }>>;
  expensesByCard(start: string, end: string): Promise<Array<{ id: Uuid; label: string; value: number; color: string }>>;
  upcomingFixedExpenses(yearMonth: string, start: string, end: string): Promise<FixedExpense[]>;
}
