import { contextBridge, ipcRenderer } from 'electron';
import { APP_CHANNELS, type IAppAPI } from '../src/interfaces/AppBridge';
import { IPC_CHANNELS, type IElectronAPI } from '../src/interfaces/IElectronBridge';
import type { BridgeEnvelope, SerializedBridgeError } from '../src/bridge';

/**
 * invoke que devolve erros limpos: o main serializa o AppError do core com o prefixo
 * APPERR: e aqui ele vira { message em português, code (VALIDATION, OFFLINE...), details }.
 */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (err: any) {
    const raw: string = err?.message ?? String(err);
    const idx = raw.indexOf('APPERR:');
    if (idx === -1) throw { message: raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') } satisfies SerializedBridgeError;
    throw JSON.parse(raw.slice(idx + 'APPERR:'.length)) as SerializedBridgeError;
  }
}

/**
 * O contextBridge só preserva `message` de um Error lançado. Por isso cada método
 * devolve um envelope { ok, value | error } e o renderer (src/bridge.ts) remonta o
 * erro com `code` e `details`. Assinaturas (on*) passam direto.
 */
function envelope<T extends object>(api: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(api)) {
    if (typeof fn !== 'function' || name.startsWith('on')) {
      out[name] = fn;
      continue;
    }
    out[name] = async (...args: unknown[]): Promise<BridgeEnvelope<unknown>> => {
      try {
        return { ok: true, value: await fn(...args) };
      } catch (err: any) {
        return { ok: false, error: { message: err?.message ?? String(err), code: err?.code, details: err?.details ?? undefined } };
      }
    };
  }
  return out;
}

function subscribe<T>(channel: string, callback: (payload: T) => void) {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const electronAPI: IElectronAPI = {
  getCategories: (params) => invoke(IPC_CHANNELS.CATEGORIES_LIST, params),
  createCategory: (category) => invoke(IPC_CHANNELS.CATEGORIES_CREATE, category),
  updateCategory: (id, category) => invoke(IPC_CHANNELS.CATEGORIES_UPDATE, id, category),
  deleteCategory: (id) => invoke(IPC_CHANNELS.CATEGORIES_DELETE, id),

  getCreditCards: (params) => invoke(IPC_CHANNELS.CREDIT_CARDS_LIST, params),
  createCreditCard: (card) => invoke(IPC_CHANNELS.CREDIT_CARDS_CREATE, card),
  updateCreditCard: (id, card) => invoke(IPC_CHANNELS.CREDIT_CARDS_UPDATE, id, card),
  deleteCreditCard: (id) => invoke(IPC_CHANNELS.CREDIT_CARDS_DELETE, id),

  getMovements: (filters) => invoke(IPC_CHANNELS.MOVEMENTS_LIST, filters),
  createMovement: (movement) => invoke(IPC_CHANNELS.MOVEMENTS_CREATE, movement),
  updateMovement: (id, movement) => invoke(IPC_CHANNELS.MOVEMENTS_UPDATE, id, movement),
  deleteMovement: (id) => invoke(IPC_CHANNELS.MOVEMENTS_DELETE, id),
  previewBulkDeleteCardMovements: (params) => invoke(IPC_CHANNELS.MOVEMENTS_BULK_DELETE_PREVIEW, params),
  bulkDeleteCardMovements: (params) => invoke(IPC_CHANNELS.MOVEMENTS_BULK_DELETE, params),

  selectImportFile: () => invoke(IPC_CHANNELS.MOVEMENTS_IMPORT_SELECT_FILE),
  parseImportFile: (params) => invoke(IPC_CHANNELS.MOVEMENTS_IMPORT_PARSE, params),
  executeImportMovements: (params) => invoke(IPC_CHANNELS.MOVEMENTS_IMPORT_EXECUTE, params),

  getFixedExpenses: (params) => invoke(IPC_CHANNELS.FIXED_EXPENSES_LIST, params),
  createFixedExpense: (expense) => invoke(IPC_CHANNELS.FIXED_EXPENSES_CREATE, expense),
  updateFixedExpense: (id, expense) => invoke(IPC_CHANNELS.FIXED_EXPENSES_UPDATE, id, expense),
  deleteFixedExpense: (id) => invoke(IPC_CHANNELS.FIXED_EXPENSES_DELETE, id),
  toggleFixedExpensePaid: (id, yearMonth, paid) => invoke(IPC_CHANNELS.FIXED_EXPENSES_TOGGLE_PAID, id, yearMonth, paid),

  getDashboardData: (yearMonth) => invoke(IPC_CHANNELS.DASHBOARD_GET_DATA, yearMonth),
};

const C = APP_CHANNELS;
const appAPI: IAppAPI = {
  getState: () => invoke(C.STATE_GET),
  onStateChanged: (cb) => subscribe(C.STATE_CHANGED, cb),
  onDataChanged: (cb) => subscribe(C.DATA_CHANGED, () => cb()),

  checkConnection: (url, key) => invoke(C.CONNECTION_CHECK, url, key),
  testConnection: () => invoke(C.CONNECTION_TEST),
  saveConnection: (url, key) => invoke(C.CONNECTION_SAVE, url, key),
  useConnectionCode: (code) => invoke(C.CONNECTION_USE_CODE, code),
  forgetConnection: () => invoke(C.CONNECTION_FORGET),
  getSetupSql: () => invoke(C.CONNECTION_SETUP_SQL),

  signIn: (email, password) => invoke(C.AUTH_SIGN_IN, email, password),
  signUp: (name, email, password) => invoke(C.AUTH_SIGN_UP, name, email, password),
  requestPasswordReset: (email) => invoke(C.AUTH_RESET_PASSWORD, email),
  pendingChanges: () => invoke(C.AUTH_PENDING_CHANGES),
  signOut: (force) => invoke(C.AUTH_SIGN_OUT, !!force),
  changePassword: (password) => invoke(C.AUTH_CHANGE_PASSWORD, password),
  updateProfile: (data) => invoke(C.PROFILE_UPDATE, data),

  createFamily: (name) => invoke(C.FAMILY_CREATE, name),
  joinFamily: (code) => invoke(C.FAMILY_JOIN, code),
  selectFamily: (id) => invoke(C.FAMILY_SELECT, id),
  createInvite: () => invoke(C.FAMILY_INVITE),
  setMemberActive: (userId, active) => invoke(C.FAMILY_SET_MEMBER_ACTIVE, userId, active),

  createDeviceLink: () => invoke(C.DEVICES_CREATE_LINK),
  pendingPairings: () => invoke(C.DEVICES_PENDING),
  resolvePairing: (id, approve) => invoke(C.DEVICES_RESOLVE, id, approve),
  listDevices: () => invoke(C.DEVICES_LIST),
  revokeDevice: (id) => invoke(C.DEVICES_REVOKE, id),
  onPairingRequest: (cb) => subscribe(C.DEVICES_PAIRING_REQUEST, cb),

  getSyncStatus: () => invoke(C.SYNC_STATUS),
  onSyncStatus: (cb) => subscribe(C.SYNC_STATUS_CHANGED, cb),
  syncNow: () => invoke(C.SYNC_NOW),
  listSyncFailed: () => invoke(C.SYNC_FAILED),
  retrySyncFailed: () => invoke(C.SYNC_RETRY),
  discardSyncFailed: (id) => invoke(C.SYNC_DISCARD, id),
};

contextBridge.exposeInMainWorld('__bridge', { electron: envelope(electronAPI), app: envelope(appAPI) });
