import { APP_CHANNELS } from '../../src/interfaces/AppBridge';
import type { AppController } from '../app/appController';
import { handle } from '../app/ipcHelpers';

/** Handlers da v2: conexão, conta, família, aparelhos e sincronização. */
export function registerAppIpc(c: AppController) {
  handle(APP_CHANNELS.STATE_GET, () => c.getState());

  handle(APP_CHANNELS.CONNECTION_CHECK, (url: string, key: string) => c.checkConnection(url, key));
  handle(APP_CHANNELS.CONNECTION_TEST, () => c.testConnection());
  handle(APP_CHANNELS.CONNECTION_SAVE, (url: string, key: string) => c.saveConnection(url, key));
  handle(APP_CHANNELS.CONNECTION_USE_CODE, (code: string) => c.useConnectionCode(code));
  handle(APP_CHANNELS.CONNECTION_FORGET, () => c.forgetConnection());
  handle(APP_CHANNELS.CONNECTION_SETUP_SQL, () => c.getSetupSql());

  handle(APP_CHANNELS.AUTH_SIGN_IN, (email: string, password: string) => c.signIn(email, password));
  handle(APP_CHANNELS.AUTH_SIGN_UP, (name: string, email: string, password: string) => c.signUp(name, email, password));
  handle(APP_CHANNELS.AUTH_RESET_PASSWORD, (email: string) => c.requestPasswordReset(email));
  handle(APP_CHANNELS.AUTH_PENDING_CHANGES, () => c.pendingChanges());
  handle(APP_CHANNELS.AUTH_SIGN_OUT, (force?: boolean) => c.signOut(!!force));
  handle(APP_CHANNELS.AUTH_CHANGE_PASSWORD, (password: string) => c.changePassword(password));
  handle(APP_CHANNELS.PROFILE_UPDATE, (data: { name: string; phone?: string | null; avatar_url?: string | null }) => c.updateProfile(data));

  handle(APP_CHANNELS.FAMILY_CREATE, (name: string) => c.createFamily(name));
  handle(APP_CHANNELS.FAMILY_JOIN, (code: string) => c.joinFamily(code));
  handle(APP_CHANNELS.FAMILY_SELECT, (id: string) => c.selectFamily(id));
  handle(APP_CHANNELS.FAMILY_INVITE, () => c.createInvite());
  handle(APP_CHANNELS.FAMILY_SET_MEMBER_ACTIVE, (userId: string, active: boolean) => c.setMemberActive(userId, active));

  handle(APP_CHANNELS.DEVICES_CREATE_LINK, () => c.createDeviceLink());
  handle(APP_CHANNELS.DEVICES_PENDING, () => c.pendingPairings());
  handle(APP_CHANNELS.DEVICES_RESOLVE, (id: string, approve: boolean) => c.resolvePairing(id, approve));
  handle(APP_CHANNELS.DEVICES_LIST, () => c.listDevices());
  handle(APP_CHANNELS.DEVICES_REVOKE, (id: string) => c.revokeDevice(id));

  handle(APP_CHANNELS.SYNC_STATUS, () => c.syncStatus());
  handle(APP_CHANNELS.SYNC_NOW, () => c.syncNow());
  handle(APP_CHANNELS.SYNC_FAILED, () => c.listSyncFailed());
  handle(APP_CHANNELS.SYNC_RETRY, () => c.retrySyncFailed());
  handle(APP_CHANNELS.SYNC_DISCARD, (id: number) => c.discardSyncFailed(id));
}
