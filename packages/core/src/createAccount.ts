import type { SupabaseConnection } from './connection/connection';
import type { KeyValueStore } from './connection/storage';
import type { Core } from './createCore';
import type { MemorySessionProvider } from './domain/ports';
import type { AuthGateway, DeviceGateway, FamilyGateway, PairingFunction } from './remote/gateways';
import * as account from './use-cases/account';
import * as devices from './use-cases/devices';
import * as families from './use-cases/families';

export interface AccountDependencies {
  core: Core;
  /** A mesma instância passada ao createCore. */
  session: MemorySessionProvider;
  /** Normalmente um SupabaseGateway, que implementa as três portas. */
  gateway: AuthGateway & FamilyGateway & DeviceGateway;
  /** Edge Function pair-device de um projeto (o celular lê o projeto do QR). */
  pairingFor: (connection: SupabaseConnection) => PairingFunction;
  connection: SupabaseConnection;
  /** Store seguro do app (guarda a família ativa por usuário). */
  keyValue: KeyValueStore;
  sleep?: (ms: number) => Promise<void>;
}

/** Raiz de composição dos use cases de conta, família e aparelhos. */
export function createAccount(deps: AccountDependencies) {
  const { core, gateway, session, connection } = deps;
  const sleep =
    deps.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout(resolve, ms)));
  const accountSession = new account.AccountSession(
    gateway,
    gateway,
    core.store,
    core.repos.families,
    session,
    new account.ActiveFamilyStore(deps.keyValue),
  );

  return {
    session: accountSession,
    signUp: new account.SignUp(gateway, accountSession),
    signIn: new account.SignIn(gateway, accountSession),
    signOut: new account.SignOut(gateway, core.store, session),
    requestPasswordReset: new account.RequestPasswordReset(gateway),
    changePassword: new account.ChangePassword(gateway),
    getProfile: new account.GetProfile(gateway, gateway),
    updateProfile: new account.UpdateProfile(gateway, gateway),
    families: {
      create: new families.CreateFamily(gateway, accountSession, core.categories.seedDefaults),
      join: new families.JoinFamily(gateway, accountSession, connection),
      createInvite: new families.CreateFamilyInvite(gateway, gateway, core.repos.families, connection),
      listMembers: new families.ListMembers(core.repos.families),
      setMemberActive: new families.SetMemberActive(gateway),
    },
    devices: {
      createLink: new devices.CreateDeviceLink(gateway, gateway, core.repos.families, connection),
      listPending: new devices.ListPendingPairings(gateway),
      resolve: new devices.ResolvePairing(gateway),
      scan: new devices.ScanDeviceLink(deps.pairingFor),
      waitApproval: new devices.WaitPairingApproval(deps.pairingFor, sleep),
      completePairing: new devices.CompletePairing(gateway, gateway),
      register: new devices.RegisterDevice(gateway),
      list: new devices.ListDevices(gateway, gateway),
      revoke: new devices.RevokeDevice(gateway),
    },
  };
}

export type Account = ReturnType<typeof createAccount>;
