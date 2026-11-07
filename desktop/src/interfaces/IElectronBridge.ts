import {
  Category,
  CreditCard,
  DashboardData,
  FixedExpense,
  Movement,
  MovementFilters,
  TransactionType,
} from '../types/database';

export const IPC_CHANNELS = {
  CATEGORIES_LIST: 'categories:list',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',

  CREDIT_CARDS_LIST: 'credit-cards:list',
  CREDIT_CARDS_CREATE: 'credit-cards:create',
  CREDIT_CARDS_UPDATE: 'credit-cards:update',
  CREDIT_CARDS_DELETE: 'credit-cards:delete',

  MOVEMENTS_LIST: 'movements:list',
  MOVEMENTS_CREATE: 'movements:create',
  MOVEMENTS_UPDATE: 'movements:update',
  MOVEMENTS_DELETE: 'movements:delete',
  MOVEMENTS_IMPORT_SELECT_FILE: 'movements:import-select-file',
  MOVEMENTS_IMPORT_PARSE: 'movements:import-parse',
  MOVEMENTS_IMPORT_EXECUTE: 'movements:import-execute',
  MOVEMENTS_BULK_DELETE_PREVIEW: 'movements:bulk-delete-preview',
  MOVEMENTS_BULK_DELETE: 'movements:bulk-delete',

  FIXED_EXPENSES_LIST: 'fixed-expenses:list',
  FIXED_EXPENSES_CREATE: 'fixed-expenses:create',
  FIXED_EXPENSES_UPDATE: 'fixed-expenses:update',
  FIXED_EXPENSES_DELETE: 'fixed-expenses:delete',
  FIXED_EXPENSES_TOGGLE_PAID: 'fixed-expenses:toggle-paid',

  DASHBOARD_GET_DATA: 'dashboard:get-data',
} as const;

/** Resultado paginado retornado por todos os handlers de listagem. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  currentPage: number;
  perPage: number;
  summary?: {
    totalIncome: number;
    totalExpense: number;
    incomeCount: number;
    expenseCount: number;
  };
}

/** Parâmetros de paginação padrão (seguindo padrão Atlas). */
export interface PaginationParams {
  page?: number;       // 0-indexed (igual ao MUI TablePagination)
  perPage?: number;
  search?: string;
  orderField?: string;
  orderDirection?: 'asc' | 'desc';
}

export type ImportBankType = 'AUTO' | 'NUBANK' | 'INTER';

export interface ImportPreviewItem {
  id: string;
  /** Chave de deduplicação (movements.import_hash): reimportar o mesmo arquivo não duplica. */
  importHash: string;
  date: string;
  originalDate?: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  categoryId: string | null;
  creditCardId: string | null;
  isInvoicePayment: boolean;
  notes?: string;
  bank?: string;
  categoryHint?: string;
  transactionTypeHint?: string;
  potentialDuplicate: {
    isDuplicate: boolean;
    reason?: string;
    existingMovementId?: string;
    existingFixedExpenseId?: string;
  };
  selected: boolean;
}

export interface ImportParseResult {
  items: ImportPreviewItem[];
  totalCount: number;
  duplicateCount: number;
  invoicePaymentCount: number;
  totalExpense: number;
  totalIncome: number;
  fileName?: string;
  detectedBank?: ImportBankType;
  /** Vencimento aplicado aos itens (quando há cartão). */
  invoiceDate?: string | null;
  /** Itens já importados antes (mesmo import_hash), que vêm desmarcados. */
  alreadyImportedCount?: number;
}

export interface ImportExecuteItem {
  importHash: string;
  date: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  categoryId: string | null;
  creditCardId: string | null;
  notes?: string;
}

export interface ImportExecuteParams {
  items: ImportExecuteItem[];
}

export interface ImportExecuteResult {
  success: boolean;
  importedCount: number;
  /** Itens ignorados porque já tinham sido importados. */
  skippedCount?: number;
  error?: string;
}

/** Parâmetros da exclusão em lote: todos os lançamentos de um cartão em um mês (YYYY-MM). */
export interface BulkDeleteCardParams {
  creditCardId: string;
  yearMonth: string;
}

export interface BulkDeleteCardPreview {
  count: number;
  totalExpense: number;
  totalIncome: number;
  fixedCount: number;
  /** De quem são os lançamentos que serão excluídos. */
  members: Array<{ member_id: string; name: string | null; count: number }>;
}

export interface BulkDeleteCardResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}

export interface IElectronAPI {
  // Categorias (paginado)
  getCategories: (params?: PaginationParams & { yearMonth?: string; type?: 'ALL' | 'INCOME' | 'EXPENSE' }) => Promise<PaginatedResult<Category>>;
  createCategory: (category: Omit<Category, 'id' | 'created_at'>) => Promise<Category>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;

  // Cartões de crédito (paginado)
  getCreditCards: (params?: PaginationParams) => Promise<PaginatedResult<CreditCard>>;
  createCreditCard: (card: Omit<CreditCard, 'id' | 'created_at'>) => Promise<CreditCard>;
  updateCreditCard: (id: string, card: Partial<CreditCard>) => Promise<boolean>;
  deleteCreditCard: (id: string) => Promise<boolean>;

  // Movimentações (paginado)
  getMovements: (filters?: MovementFilters & PaginationParams) => Promise<PaginatedResult<Movement>>;
  createMovement: (movement: Omit<Movement, 'id' | 'created_at'>) => Promise<Movement>;
  updateMovement: (id: string, movement: Partial<Movement>) => Promise<boolean>;
  deleteMovement: (id: string) => Promise<boolean>;
  previewBulkDeleteCardMovements: (params: BulkDeleteCardParams) => Promise<BulkDeleteCardPreview>;
  bulkDeleteCardMovements: (params: BulkDeleteCardParams) => Promise<BulkDeleteCardResult>;

  // Importação de faturas e extratos
  selectImportFile: () => Promise<{ success: boolean; filePath?: string; content?: string; fileName?: string; error?: string }>;
  parseImportFile: (params: {
    filePath?: string;
    content?: string;
    fileName?: string;
    creditCardId?: string | null;
    bankType?: ImportBankType;
  }) => Promise<ImportParseResult>;
  executeImportMovements: (params: ImportExecuteParams) => Promise<ImportExecuteResult>;

  // Despesas fixas (paginado)
  getFixedExpenses: (
    params?: PaginationParams & { yearMonth?: string; type?: TransactionType }
  ) => Promise<PaginatedResult<FixedExpense>>;
  createFixedExpense: (expense: Omit<FixedExpense, 'id' | 'created_at'>) => Promise<FixedExpense>;
  updateFixedExpense: (id: string, expense: Partial<FixedExpense>) => Promise<boolean>;
  deleteFixedExpense: (id: string) => Promise<boolean>;
  toggleFixedExpensePaid: (id: string, yearMonth: string, paid: boolean) => Promise<boolean>;

  // Dashboard
  getDashboardData: (yearMonth?: string) => Promise<DashboardData>;
}


declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
