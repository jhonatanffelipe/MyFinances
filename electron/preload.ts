import { contextBridge, ipcRenderer } from 'electron';
import { IElectronAPI, IPC_CHANNELS } from '../src/interfaces/IElectronBridge';

const electronAPI: IElectronAPI = {
  getDbConfig: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_CONFIG),
  selectDbFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DB_SELECT_FOLDER),
  selectDbFile: () => ipcRenderer.invoke(IPC_CHANNELS.DB_SELECT_FILE),

  // Autenticação e perfil
  getAuthStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS),
  registerUser: (name, password) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_REGISTER, name, password),
  login: (name, password) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, name, password),
  updateProfile: (data) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_UPDATE_PROFILE, data),
  changePassword: (data) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, data),

  // Categorias
  getCategories: (params) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_LIST, params),
  createCategory: (category) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_CREATE, category),
  updateCategory: (id, category) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_UPDATE, id, category),
  deleteCategory: (id) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_DELETE, id),

  // Cartões de crédito
  getCreditCards: (params) => ipcRenderer.invoke(IPC_CHANNELS.CREDIT_CARDS_LIST, params),
  createCreditCard: (card) => ipcRenderer.invoke(IPC_CHANNELS.CREDIT_CARDS_CREATE, card),
  updateCreditCard: (id, card) => ipcRenderer.invoke(IPC_CHANNELS.CREDIT_CARDS_UPDATE, id, card),
  deleteCreditCard: (id) => ipcRenderer.invoke(IPC_CHANNELS.CREDIT_CARDS_DELETE, id),

  // Movimentações
  getMovements: (filters) => ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_LIST, filters),
  createMovement: (movement) => ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_CREATE, movement),
  updateMovement: (id, movement) => ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_UPDATE, id, movement),
  deleteMovement: (id) => ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_DELETE, id),
  previewBulkDeleteCardMovements: (params) =>
    ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_BULK_DELETE_PREVIEW, params),
  bulkDeleteCardMovements: (params) => ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_BULK_DELETE, params),

  // Importação de faturas e extratos
  selectImportFile: () => ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_IMPORT_SELECT_FILE),
  parseImportFile: (params) => ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_IMPORT_PARSE, params),
  executeImportMovements: (params) => ipcRenderer.invoke(IPC_CHANNELS.MOVEMENTS_IMPORT_EXECUTE, params),

  // Despesas fixas
  getFixedExpenses: (params) => ipcRenderer.invoke(IPC_CHANNELS.FIXED_EXPENSES_LIST, params),
  createFixedExpense: (expense) => ipcRenderer.invoke(IPC_CHANNELS.FIXED_EXPENSES_CREATE, expense),
  updateFixedExpense: (id, expense) => ipcRenderer.invoke(IPC_CHANNELS.FIXED_EXPENSES_UPDATE, id, expense),
  deleteFixedExpense: (id) => ipcRenderer.invoke(IPC_CHANNELS.FIXED_EXPENSES_DELETE, id),
  toggleFixedExpensePaid: (id, yearMonth, paid) =>
    ipcRenderer.invoke(IPC_CHANNELS.FIXED_EXPENSES_TOGGLE_PAID, id, yearMonth, paid),

  // Dashboard
  getDashboardData: (yearMonth) => ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_GET_DATA, yearMonth),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
