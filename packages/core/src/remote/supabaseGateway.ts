import { base64UrlDecode } from '../connection/base64url';
import type { FetchLike } from '../connection/checkConnection';
import type { SupabaseConnection } from '../connection/connection';
import type { KeyValueStore } from '../connection/storage';
import { AppError } from '../errors/AppError';
import type { Uuid } from '../domain/types';
import type {
  AuthGateway,
  AuthUser,
  ConnectedDevice,
  DeviceGateway,
  DeviceLinkTokens,
  FamilyGateway,
  PairingFunction,
  PairingStatus,
  PendingPairing,
  ProfileData,
  RemoteFamily,
} from './gateways';

/**
 * Chave fixa da sessão no storage. O app cria o client com `auth.storageKey` igual a esta,
 * para o core conseguir ler a sessão salva mesmo offline.
 */
export const SUPABASE_AUTH_STORAGE_KEY = 'myfinances.auth';

/** O pedaço do client do supabase-js que o core usa (tipado de forma estrutural). */
export interface SupabaseLike {
  auth: any;
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: any; status?: number }>;
}

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/** Converte erros do Supabase (Auth, PostgREST, RPC) em AppError com código estável. */
export function mapSupabaseError(error: SupabaseErrorLike | null | undefined): AppError {
  const message = error?.message ?? 'Erro desconhecido';
  const code = error?.code ?? '';
  const text = `${code} ${message}`;
  if (/fetch|network|Failed to fetch|ECONNREFUSED|ENOTFOUND|timed? ?out/i.test(text) || error?.name === 'AuthRetryableFetchError') {
    return new AppError('OFFLINE', 'Sem conexão com o Supabase. Tente de novo quando houver internet.');
  }
  if (/invalid_credentials|Invalid login credentials/i.test(text)) return new AppError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos');
  if (/user_already_exists|already registered|email_exists/i.test(text)) return new AppError('EMAIL_IN_USE', 'Já existe uma conta com este e-mail');
  if (/weak_password|Password should/i.test(text)) return AppError.validation(`Senha fraca: ${message}`, { field: 'password' });
  if (/email_address_invalid|invalid.*email/i.test(text)) return AppError.validation('E-mail inválido', { field: 'email' });
  if (/invalid_or_expired_invite/.test(text)) return new AppError('INVITE_INVALID', 'Convite inválido, expirado ou já usado');
  if (/cannot_change_self/.test(text)) return AppError.validation('Você não pode desativar a si mesmo');
  if (/pairing_not_pending/.test(text)) return new AppError('PAIRING_EXPIRED', 'Esse pedido de conexão já expirou ou foi respondido');
  if (/device_not_found/.test(text)) return AppError.notFound('Aparelho', '');
  if (/forbidden/.test(text) || code === '42501') return new AppError('FORBIDDEN', 'Você não tem permissão para isso nesta família');
  if (/not_authenticated|JWT|session/i.test(text)) return new AppError('NOT_AUTHENTICATED', 'Sua sessão expirou. Entre de novo.');
  return new AppError('VALIDATION', message, { code });
}

function sessionIdFromJwt(accessToken?: string | null): string | null {
  if (!accessToken) return null;
  try {
    return JSON.parse(base64UrlDecode(accessToken.split('.')[1])).session_id ?? null;
  } catch {
    return null;
  }
}

function toAuthUser(session: any, fallbackUser?: any): AuthUser {
  const user = session?.user ?? fallbackUser;
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name ?? null,
    sessionId: sessionIdFromJwt(session?.access_token),
  };
}

async function unwrap<T>(promise: PromiseLike<{ data: T; error: any }>): Promise<T> {
  let result: { data: T; error: any };
  try {
    result = await promise;
  } catch (err) {
    throw mapSupabaseError(err as SupabaseErrorLike);
  }
  if (result.error) throw mapSupabaseError(result.error);
  return result.data;
}

/** Implementação das portas de conta, família e aparelhos sobre o supabase-js. */
export class SupabaseGateway implements AuthGateway, FamilyGateway, DeviceGateway {
  constructor(
    private readonly client: SupabaseLike,
    private readonly options: { storage?: KeyValueStore; storageKey?: string } = {},
  ) {}

  // ------------------------------------------------------------------ auth

  async signUp(input: { email: string; password: string; name: string }): Promise<AuthUser> {
    const data = await unwrap<any>(
      this.client.auth.signUp({ email: input.email, password: input.password, options: { data: { name: input.name } } }),
    );
    if (!data.session) {
      // Projeto com "Confirm email" ligado: a conta existe, mas só entra depois de confirmar
      throw new AppError('NOT_AUTHENTICATED', 'Enviamos um e-mail de confirmação. Confirme e depois entre com sua senha.', {
        reason: 'email_confirmation',
      });
    }
    return toAuthUser(data.session);
  }

  async signIn(input: { email: string; password: string }): Promise<AuthUser> {
    const data = await unwrap<any>(this.client.auth.signInWithPassword(input));
    return toAuthUser(data.session);
  }

  async signOut(): Promise<void> {
    // scope local: sai só deste aparelho (o padrão "global" derrubaria todos)
    try {
      await this.client.auth.signOut({ scope: 'local' });
    } catch {
      // offline: a sessão local é apagada mesmo assim
    }
    if (this.options.storage) await this.options.storage.removeItem(this.options.storageKey ?? SUPABASE_AUTH_STORAGE_KEY);
  }

  async currentUser(): Promise<AuthUser | null> {
    try {
      const { data } = await this.client.auth.getSession();
      if (data?.session) return toAuthUser(data.session);
    } catch {
      // segue para a sessão guardada
    }
    // Offline com token expirado: o supabase-js não consegue renovar, mas a sessão
    // continua guardada; o app abre com os dados locais e renova quando a rede voltar.
    if (!this.options.storage) return null;
    const raw = await this.options.storage.getItem(this.options.storageKey ?? SUPABASE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      const stored = JSON.parse(raw);
      return stored?.user?.id ? toAuthUser(stored) : null;
    } catch {
      return null;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    await unwrap(this.client.auth.resetPasswordForEmail(email));
  }

  async updatePassword(password: string): Promise<void> {
    await unwrap(this.client.auth.updateUser({ password }));
  }

  async updateEmail(email: string): Promise<void> {
    await unwrap(this.client.auth.updateUser({ email }));
  }

  async verifyEmailOtp(tokenHash: string): Promise<AuthUser> {
    const data = await unwrap<any>(this.client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' }));
    return toAuthUser(data.session);
  }

  // ------------------------------------------------------------------ família

  async listFamilies(): Promise<RemoteFamily[]> {
    const user = await this.currentUser();
    if (!user) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    const rows = await unwrap<any[]>(
      this.client.from('family_members').select('role, families(id, name, created_by, created_at)').eq('user_id', user.id).eq('active', true),
    );
    return rows
      .filter((r) => r.families)
      .map((r) => ({ ...r.families, role: r.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  createFamily(name: string): Promise<Uuid> {
    return unwrap(this.client.rpc('create_family', { p_name: name }));
  }

  acceptInvite(token: string): Promise<Uuid> {
    return unwrap(this.client.rpc('accept_family_invite', { p_token: token }));
  }

  createInvite(familyId: Uuid, role: 'ADMIN' | 'MEMBER' = 'MEMBER'): Promise<string> {
    return unwrap(this.client.rpc('create_family_invite', { p_family_id: familyId, p_role: role }));
  }

  async setMemberActive(familyId: Uuid, userId: Uuid, active: boolean): Promise<void> {
    await unwrap(this.client.rpc('set_member_active', { p_family_id: familyId, p_user_id: userId, p_active: active }));
  }

  async getProfile(userId: Uuid): Promise<ProfileData | null> {
    return unwrap(this.client.from('profiles').select('name, phone, avatar_url').eq('id', userId).maybeSingle());
  }

  async updateProfile(userId: Uuid, data: ProfileData): Promise<void> {
    await unwrap(this.client.from('profiles').update(data).eq('id', userId));
  }

  // ------------------------------------------------------------------ aparelhos

  async createDeviceLink(familyId: Uuid): Promise<DeviceLinkTokens> {
    const data = await unwrap<any>(this.client.rpc('create_device_link', { p_family_id: familyId }));
    return { pairToken: data.pair_token, inviteToken: data.invite_token ?? null, expiresIn: Number(data.expires_in) };
  }

  async pendingPairings(): Promise<PendingPairing[]> {
    const rows = await unwrap<any[]>(
      this.client
        .from('device_pairings')
        .select('id, device_name, family_id, expires_at')
        .eq('status', 'WAITING_APPROVAL')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    );
    return rows.map((r) => ({ id: r.id, deviceName: r.device_name, familyId: r.family_id, expiresAt: r.expires_at }));
  }

  async resolvePairing(pairingId: Uuid, approve: boolean): Promise<void> {
    await unwrap(this.client.rpc('resolve_device_pairing', { p_pairing_id: pairingId, p_approve: approve }));
  }

  async registerDevice(deviceName: string, platform: ConnectedDevice['platform']): Promise<void> {
    await unwrap(this.client.rpc('register_device', { p_device_name: deviceName, p_platform: platform }));
  }

  async listDevices(): Promise<ConnectedDevice[]> {
    const rows = await unwrap<any[]>(
      this.client.from('user_devices').select('id, session_id, device_name, platform, last_seen_at, created_at').order('last_seen_at', { ascending: false }),
    );
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      deviceName: r.device_name,
      platform: r.platform,
      lastSeenAt: r.last_seen_at,
      createdAt: r.created_at,
    }));
  }

  async revokeDevice(deviceId: Uuid): Promise<void> {
    await unwrap(this.client.rpc('revoke_device', { p_device_id: deviceId }));
  }
}

/** Edge Function `pair-device` via fetch (o celular ainda não tem sessão). */
export class SupabasePairingFunction implements PairingFunction {
  constructor(private readonly connection: SupabaseConnection, private readonly fetchFn: FetchLike) {}

  private async call(body: Record<string, unknown>): Promise<{ status: number; data: any }> {
    let res;
    try {
      res = await this.fetchFn(`${this.connection.url}/functions/v1/pair-device`, {
        method: 'POST',
        headers: { apikey: this.connection.key, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AppError('OFFLINE', 'Sem internet. Conecte-se para ler o QR Code.');
    }
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }

  async available(): Promise<boolean> {
    try {
      const { status, data } = await this.call({ action: 'ping' });
      return status === 200 && data?.ok === true;
    } catch (err) {
      if (AppError.is(err, 'OFFLINE')) throw err;
      return false;
    }
  }

  async scan(pairToken: string, deviceName: string) {
    const { status, data } = await this.call({ action: 'scan', token: pairToken, device_name: deviceName });
    if (status === 410 || data?.error === 'invalid_or_expired') {
      throw new AppError('PAIRING_EXPIRED', 'Este QR expirou ou já foi lido. Gere um novo no computador.');
    }
    if (status !== 200) throw new AppError('VALIDATION', `Falha ao ler o QR (${data?.error ?? status})`);
    return { userName: data.user_name ?? null, familyName: data.family_name ?? null };
  }

  async status(pairToken: string): Promise<PairingStatus> {
    const { status, data } = await this.call({ action: 'status', token: pairToken });
    if (status !== 200) throw new AppError('VALIDATION', `Falha ao consultar o pareamento (${data?.error ?? status})`);
    if (data.status === 'APPROVED') return { status: 'APPROVED', tokenHash: data.token_hash, email: data.email };
    return { status: data.status };
  }
}
