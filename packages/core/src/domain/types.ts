/**
 * Entidades do domínio. IDs são uuid (string) gerados no próprio dispositivo,
 * para que um registro criado offline já nasça com o id definitivo.
 */
export type Uuid = string;

export type TransactionType = 'INCOME' | 'EXPENSE';
/** Lançamentos aceitam também transferência entre membros da família. */
export type MovementType = TransactionType | 'TRANSFER';
export type FamilyRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type FixedExpenseRecurrence = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

/** Colunas de sincronização presentes em toda tabela compartilhada. */
export interface SyncColumns {
  family_id: Uuid;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Versão no servidor (xid8 em texto); null enquanto a linha nunca foi sincronizada. */
  change_xid: string | null;
}

export interface Family {
  id: Uuid;
  name: string;
  created_by: Uuid | null;
  created_at: string;
}

export interface FamilyMember {
  family_id: Uuid;
  user_id: Uuid;
  role: FamilyRole;
  active: boolean;
  name: string;
  avatar_url: string | null;
}

export interface Category {
  id: Uuid;
  name: string;
  description: string | null;
  type: TransactionType;
  color: string | null;
  icon: string | null;
  monthly_limit: number | null;
  /** Total lançado no mês de referência (calculado na listagem). */
  consumed?: number;
  created_at: string;
}

export interface CreditCard {
  id: Uuid;
  /** Dono do cartão (opcional, só para exibição). */
  owner_id: Uuid | null;
  description: string;
  color: string;
  due_day: number;
  active: boolean;
  created_at: string;
}

export interface Movement {
  id: Uuid;
  /** De quem é o gasto/receita. Em TRANSFER, quem envia. */
  member_id: Uuid;
  member_name?: string | null;
  /** Só em TRANSFER: quem recebe. */
  to_member_id: Uuid | null;
  to_member_name?: string | null;
  /** Quem digitou o lançamento. */
  created_by: Uuid;
  description: string;
  amount: number;
  date: string;
  type: MovementType;
  category_id: Uuid | null;
  category_name?: string | null;
  category_color?: string | null;
  credit_card_id: Uuid | null;
  credit_card_name?: string | null;
  credit_card_color?: string | null;
  credit_card_due_day?: number | null;
  fixed_expense_id: Uuid | null;
  notes: string | null;
  import_hash: string | null;
  created_at: string;
  updated_at: string;
  /** Linha sintética que agrupa os lançamentos de um cartão no mês (fatura). */
  isGroupedCard?: boolean;
  /** `${cardId}_${YYYY-MM}` da fatura agrupada. */
  groupKey?: string;
  cardMovementCount?: number;
  cardMovements?: Movement[];
}

export interface FixedExpense {
  id: Uuid;
  /** Responsável (opcional). */
  member_id: Uuid | null;
  /** Nome do responsável (join local). */
  member_name?: string | null;
  description: string;
  amount: number;
  /** EXPENSE = despesa fixa; INCOME = receita fixa. */
  type: TransactionType;
  category_id: Uuid | null;
  category_name?: string | null;
  category_color?: string | null;
  credit_card_id: Uuid | null;
  credit_card_name?: string | null;
  credit_card_color?: string | null;
  recurrence: FixedExpenseRecurrence;
  due_day: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
  /** Já tem baixa no mês de referência. */
  paid?: boolean;
  created_by: Uuid;
  created_at: string;
}

export interface MovementSummary {
  totalIncome: number;
  totalExpense: number;
  incomeCount: number;
  expenseCount: number;
}

export type SortDirection = 'asc' | 'desc';

export interface PageRequest<TField extends string = string> {
  /** Página 0-indexada (igual ao MUI TablePagination). Sem `perPage`, devolve tudo. */
  page?: number;
  perPage?: number;
  orderField?: TField;
  orderDirection?: SortDirection;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  currentPage: number;
  perPage: number;
}

export interface DashboardData {
  /** Visão calculada: família (memberId null) ou um membro. */
  view: { memberId: Uuid | null; memberName: string | null };
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  fixedExpensesTotal: number;
  balanceTrend: number;
  incomeTrend: number;
  expenseTrend: number;
  monthlyHistory: Array<{ month: string; yearMonth: string; income: number; expense: number }>;
  expensesByCategory: Array<{ id: Uuid; label: string; value: number; color: string }>;
  expensesByCard: Array<{ id: Uuid; label: string; value: number; color: string }>;
  upcomingFixedExpenses: Array<FixedExpense & { formattedDueDate: string }>;
  fixedExpensesHistory: Array<{ month: string; yearMonth: string; value: number }>;
  /** Só na visão de membro: transferências recebidas/enviadas no mês (fora de receita/despesa). */
  transferIn: number;
  transferOut: number;
  /** Receita × despesa de cada membro no mês (sempre da família toda). */
  byMember: Array<{ memberId: Uuid; name: string; income: number; expense: number }>;
}
