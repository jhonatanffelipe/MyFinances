/**
 * Contrato da v2 entre o processo main e o renderer: conexão, conta, família,
 * aparelhos e sincronização. (Os dados — categorias, lançamentos... — continuam
 * em IElectronBridge, com os mesmos canais da v1.)
 */
import type { AppState, PairingRequestView, SyncStatusView } from '@myfinances/core';

export type {
  AppPhase,
  AppState,
  AppUserView,
  FamilyView,
  MemberView,
  PairingRequestView,
  SyncStatusView,
} from '@myfinances/core';
export type { FamilyRole } from '@myfinances/core';

export interface SyncFailedItem {
  id: number;
  table_name: string;
  row_id: string;
  last_error: string;
  attempts: number;
}

export interface DeviceView {
  id: string;
  deviceName: string;
  platform: 'desktop' | 'android' | 'ios';
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}

export interface DeviceLinkView {
  code: string;
  /** QR em data URL (PNG), gerado no processo main. */
  qrDataUrl: string;
  expiresIn: number;
  canInvite: boolean;
}

export interface InviteView {
  code: string;
  qrDataUrl: string;
}

/** Erro vindo do main: `code` é o AppErrorCode do core (VALIDATION, OFFLINE...). */
export interface BridgeError extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

export const APP_CHANNELS = {
  STATE_GET: 'app:state-get',
  STATE_CHANGED: 'app:state-changed',
  DATA_CHANGED: 'app:data-changed',

  CONNECTION_CHECK: 'connection:check',
  CONNECTION_TEST: 'connection:test',
  CONNECTION_SAVE: 'connection:save',
  CONNECTION_USE_CODE: 'connection:use-code',
  CONNECTION_FORGET: 'connection:forget',
  CONNECTION_SETUP_SQL: 'connection:setup-sql',

  AUTH_SIGN_IN: 'account:sign-in',
  AUTH_SIGN_UP: 'account:sign-up',
  AUTH_RESET_PASSWORD: 'account:reset-password',
  AUTH_SIGN_OUT: 'account:sign-out',
  AUTH_PENDING_CHANGES: 'account:pending-changes',
  AUTH_CHANGE_PASSWORD: 'account:change-password',
  PROFILE_UPDATE: 'account:profile-update',

  FAMILY_CREATE: 'family:create',
  FAMILY_JOIN: 'family:join',
  FAMILY_SELECT: 'family:select',
  FAMILY_INVITE: 'family:invite',
  FAMILY_SET_MEMBER_ACTIVE: 'family:set-member-active',

  DEVICES_CREATE_LINK: 'devices:create-link',
  DEVICES_PENDING: 'devices:pending',
  DEVICES_RESOLVE: 'devices:resolve',
  DEVICES_LIST: 'devices:list',
  DEVICES_REVOKE: 'devices:revoke',
  DEVICES_PAIRING_REQUEST: 'devices:pairing-request',

  SYNC_STATUS: 'sync:status',
  SYNC_STATUS_CHANGED: 'sync:status-changed',
  SYNC_NOW: 'sync:now',
  SYNC_FAILED: 'sync:failed',
  SYNC_RETRY: 'sync:retry',
  SYNC_DISCARD: 'sync:discard',
} as const;

export interface IAppAPI {
  getState(): Promise<AppState>;
  onStateChanged(cb: (state: AppState) => void): () => void;
  /** Dados alterados por OUTRO aparelho (com debounce): a tela atual recarrega. */
  onDataChanged(cb: (change: { tables: string[] }) => void): () => void;

  checkConnection(url: string, key: string): Promise<{ schemaVersion: number }>;
  /** Testa a conexão salva. */
  testConnection(): Promise<{ schemaVersion: number }>;
  saveConnection(url: string, key: string): Promise<AppState>;
  /** Código de convite (mf1.) colado na tela Conectar: conecta ao banco dele. */
  useConnectionCode(code: string): Promise<AppState>;
  forgetConnection(): Promise<AppState>;
  getSetupSql(): Promise<string>;

  signIn(email: string, password: string): Promise<AppState>;
  signUp(name: string, email: string, password: string): Promise<AppState>;
  requestPasswordReset(email: string): Promise<void>;
  pendingChanges(): Promise<number>;
  signOut(force?: boolean): Promise<AppState>;
  changePassword(password: string): Promise<void>;
  updateProfile(data: { name: string; phone?: string | null; avatar_url?: string | null }): Promise<AppState>;

  createFamily(name: string): Promise<AppState>;
  joinFamily(codeOrToken: string): Promise<AppState>;
  selectFamily(familyId: string): Promise<AppState>;
  createInvite(): Promise<InviteView>;
  setMemberActive(userId: string, active: boolean): Promise<AppState>;

  createDeviceLink(): Promise<DeviceLinkView>;
  pendingPairings(): Promise<PairingRequestView[]>;
  resolvePairing(id: string, approve: boolean): Promise<void>;
  listDevices(): Promise<DeviceView[]>;
  revokeDevice(id: string): Promise<void>;
  onPairingRequest(cb: (request: PairingRequestView) => void): () => void;

  getSyncStatus(): Promise<SyncStatusView>;
  onSyncStatus(cb: (status: SyncStatusView) => void): () => void;
  syncNow(): Promise<void>;
  listSyncFailed(): Promise<SyncFailedItem[]>;
  retrySyncFailed(): Promise<void>;
  discardSyncFailed(id: number): Promise<void>;
}

declare global {
  interface Window {
    appAPI: IAppAPI;
  }
}
