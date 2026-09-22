export type TransactionType = 'INCOME' | 'EXPENSE';

export type FixedExpenseRecurrence = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

export interface AppUser {
  id: number;
  name: string;
  created_at?: string;
}

export interface CreditCard {
  id: number;
  description: string;
  color: string;
  due_day: number; // 1-31
  active: number; // 1 | 0
  created_at?: string;
}

export interface Category {
  id: number;
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
  id: number;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category_id: number;
  category_name?: string;
  category_color?: string;
  credit_card_id?: number | null;
  credit_card_name?: string;
  credit_card_color?: string;
  notes?: string;
  created_at?: string;
}

export interface FixedExpense {
  id: number;
  description: string;
  amount: number;
  category_id: number;
  category_name?: string;
  category_color?: string;
  credit_card_id?: number | null;
  credit_card_name?: string;
  credit_card_color?: string;
  recurrence: FixedExpenseRecurrence;
  due_day: number; // 1-31
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD (opcional)
  active: number; // 1 | 0
  notes?: string;
  /** 1 quando já existe baixa registrada para o mês de referência. */
  paid?: number;
  created_at?: string;
}

export interface MovementFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  creditCardId?: number;
  type?: TransactionType | 'ALL';
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
    income: number;
    expense: number;
  }>;
  expensesByCategory: Array<{
    id: number;
    label: string;
    value: number;
    color: string;
  }>;
  expensesByCard: Array<{
    id: number;
    label: string;
    value: number;
    color: string;
  }>;
  upcomingFixedExpenses: Array<FixedExpense & { formattedDueDate: string }>;
}

export interface AuthResult {
  success: boolean;
  user?: AppUser;
  error?: string;
}
