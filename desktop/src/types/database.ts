export type TransactionType = 'INCOME' | 'EXPENSE';
/** Lançamentos aceitam também transferência entre membros da família. */
export type MovementType = TransactionType | 'TRANSFER';
/** ids são uuid gerados no aparelho (v2). */
export type Uuid = string;

export type FixedExpenseRecurrence = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

export interface AppUser {
  id: Uuid;
  name: string;
  email?: string;
  phone?: string | null;
  avatar?: string | null;
}

export interface CreditCard {
  id: Uuid;
  owner_id?: Uuid | null;
  description: string;
  color: string;
  due_day: number; // 1-31
  active: number; // 1 | 0
  created_at?: string;
}

export interface Category {
  id: Uuid;
  name: string;
  description?: string;
  type: TransactionType;
  color?: string;
  icon?: string;
  monthly_limit?: number | null;
  /** Total gasto no mês corrente — calculado pelo backend. */
  consumed?: number;
  created_at?: string;
}

export interface Movement {
  id: Uuid;
  /** De quem é o lançamento (em transferência: quem envia). */
  member_id?: Uuid;
  member_name?: string | null;
  /** Só em transferência: quem recebe. */
  to_member_id?: Uuid | null;
  to_member_name?: string | null;
  /** Quem digitou. */
  created_by?: Uuid;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: MovementType;
  category_id: Uuid | null;
  category_name?: string;
  category_color?: string;
  credit_card_id?: Uuid | null;
  credit_card_name?: string;
  credit_card_color?: string;
  notes?: string | null;
  created_at?: string;
  isGroupedCard?: boolean;
  /** Identificador único da fatura agrupada: `${cardId}_${YYYY-MM}`. */
  groupKey?: string;
  cardMovementCount?: number;
  cardMovements?: Movement[];
}

export interface FixedExpense {
  id: Uuid;
  /** Responsável (opcional). */
  member_id?: Uuid | null;
  description: string;
  amount: number;
  /** EXPENSE = despesa fixa; INCOME = receita fixa. */
  type: TransactionType;
  category_id: Uuid | null;
  category_name?: string;
  category_color?: string;
  credit_card_id?: Uuid | null;
  credit_card_name?: string;
  credit_card_color?: string;
  recurrence: FixedExpenseRecurrence;
  due_day: number; // 1-31
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD (opcional)
  active: number; // 1 | 0
  notes?: string | null;
  /** 1 quando já existe baixa registrada para o mês de referência. */
  paid?: number;
  created_at?: string;
}

export interface MovementFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: Uuid;
  /** uuid do cartão, 'none' (sem cartão) ou 'all_ungrouped'. */
  creditCardId?: Uuid;
  /** Só lançamentos deste membro (inclui transferências que ele envia ou recebe). */
  memberId?: Uuid;
  type?: MovementType | 'ALL';
  search?: string;
  excludeSearch?: string;
}

export interface DashboardData {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  fixedExpensesTotal: number;
  balanceTrend: number;
  incomeTrend: number;
  expenseTrend: number;
  monthlyHistory: Array<{
    month: string;
    yearMonth?: string;
    income: number;
    expense: number;
  }>;
  expensesByCategory: Array<{
    id: Uuid;
    label: string;
    value: number;
    color: string;
  }>;
  expensesByCard: Array<{
    id: Uuid;
    label: string;
    value: number;
    color: string;
  }>;
  upcomingFixedExpenses: Array<FixedExpense & { formattedDueDate: string }>;
  fixedExpensesHistory: Array<{
    month: string;
    yearMonth: string;
    value: number;
  }>;
}

