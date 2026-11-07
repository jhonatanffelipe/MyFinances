import { decodeConnectionCode, encodeConnectionCode, normalizeProjectUrl, type SupabaseConnection } from '../connection/connection';
import type { FamilyRepository } from '../domain/repositories';
import type { FamilyMember, FamilyRole, Uuid } from '../domain/types';
import { AppError } from '../errors/AppError';
import type { AuthGateway, FamilyGateway } from '../remote/gateways';
import type { AccountSession, AccountState } from './account';
import type { SeedDefaultCategories } from './categories';
import { requiredText } from './validation';

/** Cria a família (online), seleciona e cria as categorias padrão no banco local. */
export class CreateFamily {
  constructor(
    private readonly families: FamilyGateway,
    private readonly account: AccountSession,
    private readonly seed: SeedDefaultCategories,
  ) {}
  async execute(name: string): Promise<AccountState> {
    const clean = requiredText(name, 'Nome da família', 80);
    if (clean.length < 2) throw AppError.validation('Nome muito curto', { field: 'name' });
    const id = await this.families.createFamily(clean);
    const state = await this.account.refreshAndSelect(id);
    await this.seed.execute();
    return state;
  }
}

/**
 * Entra numa família por convite. Aceita o código completo (`mf1.`, do QR ou colado)
 * ou só o token. O código precisa ser do mesmo banco em que o app está conectado.
 */
export class JoinFamily {
  constructor(
    private readonly families: FamilyGateway,
    private readonly account: AccountSession,
    private readonly connection: SupabaseConnection,
  ) {}
  async execute(codeOrToken: string): Promise<AccountState> {
    const raw = (codeOrToken ?? '').trim();
    let token = raw;
    if (raw.startsWith('mf1.')) {
      const code = decodeConnectionCode(raw);
      if (normalizeProjectUrl(code.url) !== normalizeProjectUrl(this.connection.url)) {
        throw new AppError('INVALID_CONNECTION', 'Este convite é de outro banco. Conecte-se ao banco do convite primeiro.', {
          reason: 'other_project',
        });
      }
      if (!code.invite) throw new AppError('INVITE_INVALID', 'Este código não tem convite (quem gerou não é administrador da família)');
      token = code.invite;
    }
    if (token.length < 16) throw new AppError('INVITE_INVALID', 'Código de convite inválido');
    const familyId = await this.families.acceptInvite(token);
    return this.account.refreshAndSelect(familyId);
  }
}

/** Gera o código de convite completo (URL + key + token) para mandar pelo WhatsApp. */
export class CreateFamilyInvite {
  constructor(
    private readonly auth: AuthGateway,
    private readonly families: FamilyGateway,
    private readonly familyRepo: FamilyRepository,
    private readonly connection: SupabaseConnection,
  ) {}
  async execute(familyId: Uuid, role: Exclude<FamilyRole, 'OWNER'> = 'MEMBER'): Promise<{ code: string; token: string }> {
    const user = await this.auth.currentUser();
    if (!user) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    const family = (await this.familyRepo.listFamilies()).find((f) => f.id === familyId);
    const token = await this.families.createInvite(familyId, role);
    const code = encodeConnectionCode({
      ...this.connection,
      family: { id: familyId, name: family?.name ?? '' },
      by: { name: user.name ?? '', email: user.email },
      invite: token,
    });
    return { code, token };
  }
}

export class ListMembers {
  constructor(private readonly familyRepo: FamilyRepository) {}
  execute(familyId: Uuid): Promise<FamilyMember[]> {
    return this.familyRepo.listMembers(familyId);
  }
}

/** Desativa ou reativa um membro (OWNER/ADMIN). O histórico dele continua na família. */
export class SetMemberActive {
  constructor(private readonly families: FamilyGateway) {}
  execute(familyId: Uuid, userId: Uuid, active: boolean): Promise<void> {
    return this.families.setMemberActive(familyId, userId, active);
  }
}
