import type { KeyValueStore } from '../connection/storage';
import type { LocalStore } from '../db/localStore';
import type { MemorySessionProvider } from '../domain/ports';
import type { FamilyRepository } from '../domain/repositories';
import type { Family, Uuid } from '../domain/types';
import { AppError } from '../errors/AppError';
import type { AuthGateway, AuthUser, FamilyGateway, ProfileData, RemoteFamily } from '../remote/gateways';
import { optionalText, requiredText } from './validation';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timers = globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (h: unknown) => void };
  let handle: unknown;
  const timeout = new Promise<never>((_, reject) => {
    handle = timers.setTimeout(() => reject(new AppError('OFFLINE', 'O Supabase não respondeu a tempo')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => timers.clearTimeout(handle));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Padrão do Supabase Auth. Se o projeto exigir mais, o servidor recusa com a própria mensagem. */
export const MIN_PASSWORD_LENGTH = 6;

export function validEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) throw AppError.validation('E-mail inválido', { field: 'email' });
  return email;
}

export function validPassword(value: unknown, min = MIN_PASSWORD_LENGTH): string {
  if (typeof value !== 'string' || value.length < min) {
    throw AppError.validation(`A senha precisa ter pelo menos ${min} caracteres`, { field: 'password' });
  }
  return value;
}

/**
 * Família ativa por aparelho e usuário. Vive no KeyValueStore do app (não no SQLite),
 * porque é lida antes de abrir o banco local.
 */
export class ActiveFamilyStore {
  constructor(private readonly store: KeyValueStore) {}
  private key(userId: Uuid) {
    return `myfinances.activeFamily.${userId}`;
  }
  get(userId: Uuid) {
    return this.store.getItem(this.key(userId));
  }
  set(userId: Uuid, familyId: Uuid) {
    return this.store.setItem(this.key(userId), familyId);
  }
  clear(userId: Uuid) {
    return this.store.removeItem(this.key(userId));
  }
}

export interface AccountState {
  user: AuthUser;
  families: Family[];
  activeFamilyId: Uuid | null;
}

/**
 * Sessão da conta: liga o usuário do Supabase Auth à sessão do core (userId + família
 * ativa) e mantém a lista de famílias no SQLite local, para o seletor funcionar offline.
 */
export class AccountSession {
  constructor(
    private readonly auth: AuthGateway,
    private readonly families: FamilyGateway,
    private readonly store: LocalStore,
    private readonly familyRepo: FamilyRepository,
    private readonly session: MemorySessionProvider,
    private readonly activeFamily: ActiveFamilyStore,
  ) {}

  /** Grava no SQLite local as famílias que vieram do servidor. */
  private async cacheFamilies(remote: RemoteFamily[]) {
    await this.store.write(async (ctx) => {
      for (const f of remote) {
        await this.familyRepo.upsertFamily(ctx, { id: f.id, name: f.name, created_by: f.created_by, created_at: f.created_at });
      }
    });
  }

  /**
   * Estado da conta a partir da sessão salva. Online, atualiza a lista de famílias;
   * offline, usa a que está no SQLite local.
   */
  async resume(options: { online?: boolean; timeoutMs?: number } = {}): Promise<AccountState | null> {
    const user = await this.auth.currentUser();
    if (!user) {
      this.session.clear();
      return null;
    }
    this.session.set({ userId: user.id, familyId: undefined });
    let families: Family[];
    try {
      if (options.online === false) throw new AppError('OFFLINE', 'Sem internet');
      // O supabase-js repete GETs que falham por rede (~7 s): abrir o app offline não pode esperar isso
      const remote = await withTimeout(this.families.listFamilies(), options.timeoutMs ?? 4000);
      await this.cacheFamilies(remote);
      const ids = new Set(remote.map((f) => f.id));
      families = (await this.familyRepo.listFamilies()).filter((f) => ids.has(f.id));
    } catch (err) {
      if (!AppError.is(err, 'OFFLINE')) throw err;
      families = await this.familyRepo.listFamilies();
    }

    const saved = await this.activeFamily.get(user.id);
    const active = families.find((f) => f.id === saved)?.id ?? families[0]?.id ?? null;
    if (active) {
      this.session.set({ userId: user.id, familyId: active });
      await this.activeFamily.set(user.id, active);
    }
    return { user, families, activeFamilyId: active };
  }

  async selectFamily(familyId: Uuid): Promise<void> {
    const user = await this.auth.currentUser();
    if (!user) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    const known = (await this.familyRepo.listFamilies()).some((f) => f.id === familyId);
    if (!known) throw new AppError('NOT_MEMBER', 'Você não faz parte dessa família');
    this.session.set({ userId: user.id, familyId });
    await this.activeFamily.set(user.id, familyId);
  }

  /** Atualiza a lista de famílias (depois de criar ou aceitar convite) e seleciona uma. */
  async refreshAndSelect(familyId: Uuid): Promise<AccountState> {
    const remote = await this.families.listFamilies();
    await this.cacheFamilies(remote);
    await this.selectFamily(familyId);
    const state = await this.resume();
    if (!state) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    return state;
  }
}

export class SignUp {
  constructor(private readonly auth: AuthGateway, private readonly account: AccountSession) {}
  async execute(input: { name: string; email: string; password: string }): Promise<AccountState> {
    const name = requiredText(input.name, 'Nome', 80);
    if (name.length < 2) throw AppError.validation('Nome muito curto', { field: 'name' });
    await this.auth.signUp({ name, email: validEmail(input.email), password: validPassword(input.password) });
    return (await this.account.resume())!;
  }
}

export class SignIn {
  constructor(private readonly auth: AuthGateway, private readonly account: AccountSession) {}
  async execute(input: { email: string; password: string }): Promise<AccountState> {
    if (typeof input.password !== 'string' || input.password.length === 0) {
      throw AppError.validation('Informe a senha', { field: 'password' });
    }
    await this.auth.signIn({ email: validEmail(input.email), password: input.password });
    return (await this.account.resume())!;
  }
}

/**
 * Sai deste aparelho. Com pendências de envio, só sai se `force` (a UI avisa antes,
 * porque o que não subiu se perde se a cópia local for apagada).
 */
export class SignOut {
  constructor(
    private readonly auth: AuthGateway,
    private readonly store: LocalStore,
    private readonly session: MemorySessionProvider,
  ) {}

  async pendingChanges(): Promise<number> {
    const row = await this.store.db.first<{ n: number }>('SELECT COUNT(*) AS n FROM _outbox');
    return Number(row?.n ?? 0);
  }

  async execute(options: { force?: boolean } = {}): Promise<void> {
    const pending = await this.pendingChanges();
    if (pending > 0 && !options.force) {
      throw new AppError('CONFLICT', `Há ${pending} alteração(ões) ainda não enviada(s). Sincronize antes de sair.`, { pending });
    }
    await this.auth.signOut();
    this.session.clear();
  }
}

export class RequestPasswordReset {
  constructor(private readonly auth: AuthGateway) {}
  execute(email: string): Promise<void> {
    return this.auth.requestPasswordReset(validEmail(email));
  }
}

export class ChangePassword {
  constructor(private readonly auth: AuthGateway) {}
  execute(password: string): Promise<void> {
    return this.auth.updatePassword(validPassword(password));
  }
}

export class GetProfile {
  constructor(private readonly auth: AuthGateway, private readonly families: FamilyGateway) {}
  async execute(): Promise<ProfileData & { email: string }> {
    const user = await this.auth.currentUser();
    if (!user) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    const profile = await this.families.getProfile(user.id);
    return { name: profile?.name ?? user.name ?? '', phone: profile?.phone ?? null, avatar_url: profile?.avatar_url ?? null, email: user.email };
  }
}

export class UpdateProfile {
  constructor(private readonly auth: AuthGateway, private readonly families: FamilyGateway) {}
  async execute(input: { name: string; phone?: string | null; avatar_url?: string | null }): Promise<void> {
    const user = await this.auth.currentUser();
    if (!user) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    const name = requiredText(input.name, 'Nome', 80);
    if (name.length < 2) throw AppError.validation('Nome muito curto', { field: 'name' });
    await this.families.updateProfile(user.id, { name, phone: optionalText(input.phone), avatar_url: optionalText(input.avatar_url) });
  }
}
