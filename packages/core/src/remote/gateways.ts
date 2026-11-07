import type { FamilyRole, Uuid } from '../domain/types';

/**
 * Portas para o Supabase usadas pelos use cases de conta, família e aparelhos.
 * A implementação padrão (SupabaseGateway) recebe o client do supabase-js criado pelo
 * app; o core não importa o pacote em runtime.
 */

export interface AuthUser {
  id: Uuid;
  email: string;
  name: string | null;
  /** Claim `session_id` do JWT (identifica este aparelho em "Aparelhos conectados"). */
  sessionId: string | null;
}

export interface AuthGateway {
  signUp(input: { email: string; password: string; name: string }): Promise<AuthUser>;
  signIn(input: { email: string; password: string }): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** Usuário da sessão salva. Funciona offline (lê o que está guardado no aparelho). */
  currentUser(): Promise<AuthUser | null>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  updateEmail(email: string): Promise<void>;
  /** Cria a sessão do celular pareado com o token_hash entregue pela Edge Function. */
  verifyEmailOtp(tokenHash: string): Promise<AuthUser>;
}

export interface RemoteFamily {
  id: Uuid;
  name: string;
  role: FamilyRole;
  created_by: Uuid | null;
  created_at: string;
}

export interface ProfileData {
  name: string;
  phone: string | null;
  avatar_url: string | null;
}

export interface FamilyGateway {
  /** Famílias em que o usuário está ativo. */
  listFamilies(): Promise<RemoteFamily[]>;
  createFamily(name: string): Promise<Uuid>;
  /** Devolve o id da família em que o usuário entrou. */
  acceptInvite(token: string): Promise<Uuid>;
  createInvite(familyId: Uuid, role?: Exclude<FamilyRole, 'OWNER'>): Promise<string>;
  setMemberActive(familyId: Uuid, userId: Uuid, active: boolean): Promise<void>;
  getProfile(userId: Uuid): Promise<ProfileData | null>;
  updateProfile(userId: Uuid, data: ProfileData): Promise<void>;
}

export interface DeviceLinkTokens {
  pairToken: string;
  inviteToken: string | null;
  expiresIn: number;
}

export interface PendingPairing {
  id: Uuid;
  deviceName: string;
  familyId: Uuid;
  expiresAt: string;
}

export interface ConnectedDevice {
  id: Uuid;
  sessionId: string;
  deviceName: string;
  platform: 'desktop' | 'android' | 'ios';
  lastSeenAt: string;
  createdAt: string;
}

export interface DeviceGateway {
  createDeviceLink(familyId: Uuid): Promise<DeviceLinkTokens>;
  /** Pedidos aguardando "Permitir" no computador (o app também recebe pelo Realtime). */
  pendingPairings(): Promise<PendingPairing[]>;
  resolvePairing(pairingId: Uuid, approve: boolean): Promise<void>;
  registerDevice(deviceName: string, platform: ConnectedDevice['platform']): Promise<void>;
  listDevices(): Promise<ConnectedDevice[]>;
  revokeDevice(deviceId: Uuid): Promise<void>;
}

export type PairingStatus =
  | { status: 'WAITING_APPROVAL' }
  | { status: 'APPROVED'; tokenHash: string; email: string }
  | { status: 'DENIED' }
  | { status: 'EXPIRED' }
  | { status: 'CONSUMED' };

/** Edge Function `pair-device`, chamada pelo celular ainda sem sessão. */
export interface PairingFunction {
  /** false quando a função não foi publicada no projeto (fallback: login com senha). */
  available(): Promise<boolean>;
  scan(pairToken: string, deviceName: string): Promise<{ userName: string | null; familyName: string | null }>;
  status(pairToken: string): Promise<PairingStatus>;
}
