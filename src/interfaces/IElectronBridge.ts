import {
  AppUser,
  AuthResult,
  Category,
  CreditCard,
  DashboardData,
  FixedExpense,
  Movement,
  MovementFilters,
  TransactionType,
} from '../types/database';

export const IPC_CHANNELS = {
  DB_GET_CONFIG: 'db:get-config',
  DB_SELECT_FOLDER: 'db:select-folder',
  DB_SELECT_FILE: 'db:select-file',

  AUTH_STATUS: 'auth:status',
  AUTH_REGISTER: 'auth:register',
  AUTH_LOGIN: 'auth:login',
  AUTH_UPDATE_PROFILE: 'auth:update-profile',
  AUTH_CHANGE_PASSWORD: 'auth:change-password',

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
  date: string;
  originalDate?: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  categoryId: number | null;
  creditCardId: number | null;
  isInvoicePayment: boolean;
  notes?: string;
  bank?: string;
  categoryHint?: string;
  transactionTypeHint?: string;
  potentialDuplicate: {
    isDuplicate: boolean;
    reason?: string;
    existingMovementId?: number;
    existingFixedExpenseId?: number;
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
}

export interface ImportExecuteItem {
  date: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  categoryId: number | null;
  creditCardId: number | null;
  notes?: string;
}

export interface ImportExecuteParams {
  items: ImportExecuteItem[];
}

export interface ImportExecuteResult {
  success: boolean;
  importedCount: number;
  error?: string;
}

/** Parâmetros da exclusão em lote: todos os lançamentos de um cartão em um mês (YYYY-MM). */
export interface BulkDeleteCardParams {
  creditCardId: number;
  yearMonth: string;
}

export interface BulkDeleteCardPreview {
  count: number;
  totalExpense: number;
  totalIncome: number;
  fixedCount: number;
}

export interface BulkDeleteCardResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}

export interface IElectronAPI {
  getDbConfig: () => Promise<{ dbPath: string | null; dbFile: string | null }>;
  selectDbFolder: () => Promise<{ success: boolean; dbPath?: string; dbFile?: string; error?: string }>;
  selectDbFile: () => Promise<{ success: boolean; dbPath?: string; dbFile?: string; error?: string }>;

  // Autenticação local e perfil
  getAuthStatus: () => Promise<{ hasUser: boolean; userName: string | null; user?: AppUser | null }>;
  registerUser: (name: string, password: string) => Promise<AuthResult>;
  login: (name: string, password: string) => Promise<AuthResult>;
  updateProfile: (data: {
    id?: number;
    name: string;
    email?: string;
    role?: string;
    phone?: string;
    avatar?: string | null;
  }) => Promise<{ success: boolean; user?: AppUser; error?: string }>;
  changePassword: (data: {
    id: number;
    currentPassword: string;
    newPassword: string;
  }) => Promise<{ success: boolean; error?: string }>;

  // Categorias (paginado)
  getCategories: (params?: PaginationParams & { yearMonth?: string; type?: 'ALL' | 'INCOME' | 'EXPENSE' }) => Promise<PaginatedResult<Category>>;
  createCategory: (category: Omit<Category, 'id' | 'created_at'>) => Promise<Category>;
  updateCategory: (id: number, category: Partial<Category>) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;

  // Cartões de crédito (paginado)
  getCreditCards: (params?: PaginationParams) => Promise<PaginatedResult<CreditCard>>;
  createCreditCard: (card: Omit<CreditCard, 'id' | 'created_at'>) => Promise<CreditCard>;
  updateCreditCard: (id: number, card: Partial<CreditCard>) => Promise<boolean>;
  deleteCreditCard: (id: number) => Promise<boolean>;

  // Movimentações (paginado)
  getMovements: (filters?: MovementFilters & PaginationParams) => Promise<PaginatedResult<Movement>>;
  createMovement: (movement: Omit<Movement, 'id' | 'created_at'>) => Promise<Movement>;
  updateMovement: (id: number, movement: Partial<Movement>) => Promise<boolean>;
  deleteMovement: (id: number) => Promise<boolean>;
  previewBulkDeleteCardMovements: (params: BulkDeleteCardParams) => Promise<BulkDeleteCardPreview>;
  bulkDeleteCardMovements: (params: BulkDeleteCardParams) => Promise<BulkDeleteCardResult>;

  // Importação de faturas e extratos
  selectImportFile: () => Promise<{ success: boolean; filePath?: string; content?: string; fileName?: string; error?: string }>;
  parseImportFile: (params: {
    filePath?: string;
    content?: string;
    fileName?: string;
    creditCardId?: number | null;
    bankType?: ImportBankType;
  }) => Promise<ImportParseResult>;
  executeImportMovements: (params: ImportExecuteParams) => Promise<ImportExecuteResult>;

  // Despesas fixas (paginado)
  getFixedExpenses: (
    params?: PaginationParams & { yearMonth?: string; type?: TransactionType }
  ) => Promise<PaginatedResult<FixedExpense>>;
  createFixedExpense: (expense: Omit<FixedExpense, 'id' | 'created_at'>) => Promise<FixedExpense>;
  updateFixedExpense: (id: number, expense: Partial<FixedExpense>) => Promise<boolean>;
  deleteFixedExpense: (id: number) => Promise<boolean>;
  toggleFixedExpensePaid: (id: number, yearMonth: string, paid: boolean) => Promise<boolean>;

  // Dashboard
  getDashboardData: (yearMonth?: string) => Promise<DashboardData>;
}

export type { AppUser };

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
