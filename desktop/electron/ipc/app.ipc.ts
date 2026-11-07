import { APP_CHANNELS } from '../../src/interfaces/AppBridge';
import type { AppController } from '../app/appController';
import { handle } from '../app/ipcHelpers';

/** Handlers da v2: conexão, conta, família, aparelhos e sincronização. */
export function registerAppIpc(c: AppController) {
  const s = c.session;
  handle(APP_CHANNELS.STATE_GET, () => s.getState());

  handle(APP_CHANNELS.CONNECTION_CHECK, (url: string, key: string) => s.checkConnection(url, key));
  handle(APP_CHANNELS.CONNECTION_TEST, () => s.testConnection());
  handle(APP_CHANNELS.CONNECTION_SAVE, (url: string, key: string) => s.saveConnection(url, key));
  handle(APP_CHANNELS.CONNECTION_USE_CODE, (code: string) => s.useConnectionCode(code));
  handle(APP_CHANNELS.CONNECTION_FORGET, () => s.forgetConnection());
  handle(APP_CHANNELS.CONNECTION_SETUP_SQL, () => c.getSetupSql());

  handle(APP_CHANNELS.AUTH_SIGN_IN, (email: string, password: string) => s.signIn(email, password));
  handle(APP_CHANNELS.AUTH_SIGN_UP, (name: string, email: string, password: string) => s.signUp(name, email, password));
  handle(APP_CHANNELS.AUTH_RESET_PASSWORD, (email: string) => s.requestPasswordReset(email));
  handle(APP_CHANNELS.AUTH_PENDING_CHANGES, () => s.pendingChanges());
  handle(APP_CHANNELS.AUTH_SIGN_OUT, (force?: boolean) => s.signOut(!!force));
  handle(APP_CHANNELS.AUTH_CHANGE_PASSWORD, (password: string) => s.changePassword(password));
  handle(APP_CHANNELS.PROFILE_UPDATE, (data: { name: string; phone?: string | null; avatar_url?: string | null }) => s.updateProfile(data));

  handle(APP_CHANNELS.FAMILY_CREATE, (name: string) => s.createFamily(name));
  handle(APP_CHANNELS.FAMILY_JOIN, (code: string) => s.joinFamily(code));
  handle(APP_CHANNELS.FAMILY_SELECT, (id: string) => s.selectFamily(id));
  handle(APP_CHANNELS.FAMILY_INVITE, () => c.createInvite());
  handle(APP_CHANNELS.FAMILY_SET_MEMBER_ACTIVE, (userId: string, active: boolean) => s.setMemberActive(userId, active));

  handle(APP_CHANNELS.DEVICES_CREATE_LINK, () => c.createDeviceLink());
  handle(APP_CHANNELS.DEVICES_PENDING, () => s.pendingPairings());
  handle(APP_CHANNELS.DEVICES_RESOLVE, (id: string, approve: boolean) => s.resolvePairing(id, approve));
  handle(APP_CHANNELS.DEVICES_LIST, () => s.listDevices());
  handle(APP_CHANNELS.DEVICES_REVOKE, (id: string) => s.revokeDevice(id));

  handle(APP_CHANNELS.V1_SELECT_FILE, () => c.selectV1File());
  handle(APP_CHANNELS.V1_IMPORT, (memberId: string | null) => c.importV1(memberId));
  handle(APP_CHANNELS.V1_CANCEL, () => c.closeV1Source());
  handle(APP_CHANNELS.V1_DISMISS_OFFER, () => s.dismissV1Offer());

  handle(APP_CHANNELS.SYNC_STATUS, () => s.syncStatus());
  handle(APP_CHANNELS.SYNC_NOW, () => s.syncNow());
  handle(APP_CHANNELS.SYNC_FAILED, () => s.listSyncFailed());
  handle(APP_CHANNELS.SYNC_RETRY, () => s.retrySyncFailed());
  handle(APP_CHANNELS.SYNC_DISCARD, (id: number) => s.discardSyncFailed(id));
}
