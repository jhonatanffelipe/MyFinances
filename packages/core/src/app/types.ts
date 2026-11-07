import type { FamilyRole, Uuid } from '../domain/types';
import type { SyncStatus } from '../sync/syncEngine';

/** Fases do app: connect (sem banco) → login → family (sem família) → ready. */
export type AppPhase = 'loading' | 'connect' | 'login' | 'family' | 'ready';

export interface AppUserView {
  id: Uuid;
  email: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
}

export interface FamilyView {
  id: Uuid;
  name: string;
}

export interface MemberView {
  user_id: Uuid;
  name: string;
  role: FamilyRole;
  active: boolean;
  avatar_url: string | null;
}

/** Estado que as telas observam (desktop via IPC, mobile direto). */
export interface AppState {
  phase: AppPhase;
  connection: { url: string; projectRef: string } | null;
  user: AppUserView | null;
  families: FamilyView[];
  activeFamilyId: Uuid | null;
  role: FamilyRole | null;
  members: MemberView[];
  /** Convite recebido antes do login (código colado ou "Sou outra pessoa" no QR). */
  pendingInvite: { familyName: string | null; by: string | null } | null;
  /** E-mail sugerido no login (QR "Sou eu" sem a Edge Function). */
  loginHint: { email: string | null } | null;
  /** Logo depois de criar a família: "Você já usa o MyFinances v1? Importar / Começar do zero". */
  offerV1Import: boolean;
  online: boolean;
}

export type SyncStatusView = SyncStatus;

export const IDLE_SYNC_STATUS: SyncStatusView = {
  phase: 'idle',
  pending: 0,
  failed: 0,
  lastSyncAt: null,
  lastError: null,
  lastConflicts: 0,
  pulledRows: 0,
};

export const INITIAL_APP_STATE: AppState = {
  phase: 'loading',
  connection: null,
  user: null,
  families: [],
  activeFamilyId: null,
  role: null,
  members: [],
  pendingInvite: null,
  loginHint: null,
  offerV1Import: false,
  online: true,
};

/** Pedido de "Conectar celular" aguardando Permitir/Negar no computador. */
export interface PairingRequestView {
  id: Uuid;
  deviceName: string;
  familyId: Uuid;
  expiresAt: string;
}

/** O que o celular mostra depois de ler o QR do computador. */
export interface QrPreview {
  familyName: string | null;
  byName: string | null;
  /** "Sou eu" sem senha (Edge Function publicada e QR de pareamento). */
  canPair: boolean;
  /** "Sou outra pessoa" (QR gerado por OWNER/ADMIN). */
  canInvite: boolean;
}
