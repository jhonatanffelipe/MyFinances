import { decodeConnectionCode, encodeConnectionCode, type ConnectionCode, type SupabaseConnection } from '../connection/connection';
import type { FamilyRepository } from '../domain/repositories';
import type { Uuid } from '../domain/types';
import { AppError } from '../errors/AppError';
import type {
  AuthGateway,
  AuthUser,
  ConnectedDevice,
  DeviceGateway,
  PairingFunction,
  PendingPairing,
} from '../remote/gateways';

// ------------------------------------------------------------------ computador

/** Gera o QR "Conectar celular": pareamento ("Sou eu") e, se OWNER/ADMIN, convite. */
export class CreateDeviceLink {
  constructor(
    private readonly auth: AuthGateway,
    private readonly devices: DeviceGateway,
    private readonly familyRepo: FamilyRepository,
    private readonly connection: SupabaseConnection,
  ) {}
  async execute(familyId: Uuid): Promise<{ code: string; expiresIn: number; canInvite: boolean }> {
    const user = await this.auth.currentUser();
    if (!user) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    const family = (await this.familyRepo.listFamilies()).find((f) => f.id === familyId);
    const tokens = await this.devices.createDeviceLink(familyId);
    const code = encodeConnectionCode({
      ...this.connection,
      family: { id: familyId, name: family?.name ?? '' },
      by: { name: user.name ?? '', email: user.email },
      pair: tokens.pairToken,
      invite: tokens.inviteToken,
    });
    return { code, expiresIn: tokens.expiresIn, canInvite: tokens.inviteToken !== null };
  }
}

export class ListPendingPairings {
  constructor(private readonly devices: DeviceGateway) {}
  execute(): Promise<PendingPairing[]> {
    return this.devices.pendingPairings();
  }
}

export class ResolvePairing {
  constructor(private readonly devices: DeviceGateway) {}
  execute(pairingId: Uuid, approve: boolean): Promise<void> {
    return this.devices.resolvePairing(pairingId, approve);
  }
}

// ------------------------------------------------------------------ celular

export type ScanResult =
  | { mode: 'pair'; code: ConnectionCode; userName: string | null; familyName: string | null; canInvite: boolean }
  | { mode: 'password'; code: ConnectionCode; email: string | null; canInvite: boolean };

/**
 * Celular leu o QR. Com a Edge Function publicada, reserva o QR ("Sou eu") e o
 * computador recebe o pedido. Sem ela, cai no login com o e-mail preenchido.
 * O caminho "Sou outra pessoa" usa só `code.invite` e não depende da função.
 */
export class ScanDeviceLink {
  constructor(private readonly pairingFor: (connection: SupabaseConnection) => PairingFunction) {}

  async decode(text: string): Promise<{ code: ConnectionCode; pairingAvailable: boolean }> {
    const code = decodeConnectionCode(text);
    const pairingAvailable = !!code.pair && (await this.pairingFor(code).available());
    return { code, pairingAvailable };
  }

  /** Só para "Sou eu". */
  async execute(text: string, deviceName: string): Promise<ScanResult> {
    const { code, pairingAvailable } = await this.decode(text);
    const canInvite = !!code.invite;
    if (!pairingAvailable || !code.pair) return { mode: 'password', code, email: code.by?.email ?? null, canInvite };
    const name = deviceName.trim().slice(0, 60) || 'Celular';
    const scanned = await this.pairingFor(code).scan(code.pair, name);
    return { mode: 'pair', code, ...scanned, canInvite };
  }
}

/** Espera o "Permitir" no computador (consulta a cada 2 s até o QR expirar). */
export class WaitPairingApproval {
  constructor(
    private readonly pairingFor: (connection: SupabaseConnection) => PairingFunction,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  async execute(code: ConnectionCode, options: { intervalMs?: number; timeoutMs?: number; isCancelled?: () => boolean } = {}): Promise<string> {
    if (!code.pair) throw new AppError('PAIRING_EXPIRED', 'Este QR não permite conectar sem senha');
    const fn = this.pairingFor(code);
    const deadline = Date.now() + (options.timeoutMs ?? 3 * 60_000);
    for (;;) {
      if (options.isCancelled?.()) throw new AppError('PAIRING_EXPIRED', 'Conexão cancelada');
      const result = await fn.status(code.pair);
      switch (result.status) {
        case 'APPROVED':
          return result.tokenHash;
        case 'DENIED':
          throw new AppError('PAIRING_DENIED', 'Conexão recusada no computador.');
        case 'EXPIRED':
          throw new AppError('PAIRING_EXPIRED', 'Este QR expirou. Gere um novo no computador.');
        case 'CONSUMED':
          throw new AppError('PAIRING_USED', 'Este QR já foi usado.');
      }
      if (Date.now() > deadline) throw new AppError('PAIRING_EXPIRED', 'Tempo esgotado. Gere um novo QR no computador.');
      await this.sleep(options.intervalMs ?? 2000);
    }
  }
}

/** Cria a sessão PRÓPRIA do celular com o token da aprovação e registra o aparelho. */
export class CompletePairing {
  constructor(private readonly auth: AuthGateway, private readonly devices: DeviceGateway) {}
  async execute(tokenHash: string, device: { name: string; platform: ConnectedDevice['platform'] }): Promise<AuthUser> {
    const user = await this.auth.verifyEmailOtp(tokenHash);
    await this.devices.registerDevice(device.name, device.platform);
    return user;
  }
}

// ------------------------------------------------------------------ todos os aparelhos

/** Todo aparelho se registra após o login, para aparecer em "Aparelhos conectados". */
export class RegisterDevice {
  constructor(private readonly devices: DeviceGateway) {}
  execute(name: string, platform: ConnectedDevice['platform']): Promise<void> {
    return this.devices.registerDevice(name.trim().slice(0, 60) || 'Aparelho', platform);
  }
}

export class ListDevices {
  constructor(private readonly auth: AuthGateway, private readonly devices: DeviceGateway) {}
  async execute(): Promise<Array<ConnectedDevice & { current: boolean }>> {
    const user = await this.auth.currentUser();
    const list = await this.devices.listDevices();
    return list.map((d) => ({ ...d, current: d.sessionId === user?.sessionId }));
  }
}

/** Desconecta um aparelho: apaga a sessão no Auth (efeito em até 1 h, quando o token expira). */
export class RevokeDevice {
  constructor(private readonly devices: DeviceGateway) {}
  execute(deviceId: Uuid): Promise<void> {
    return this.devices.revokeDevice(deviceId);
  }
}
