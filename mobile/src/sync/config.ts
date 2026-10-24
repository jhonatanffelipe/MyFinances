import Constants from 'expo-constants';

/**
 * Client ID do app registrado no Microsoft Entra (portal.azure.com).
 * Defina em app.json → expo.extra.microsoftClientId. Veja o README do mobile.
 */
export const MICROSOFT_CLIENT_ID: string = (Constants.expoConfig?.extra as any)?.microsoftClientId || '';

/** "common" aceita contas pessoais (OneDrive) e corporativas (OneDrive for Business). */
export const MICROSOFT_DISCOVERY = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

export const MICROSOFT_SCOPES = ['openid', 'profile', 'offline_access', 'User.Read', 'Files.ReadWrite'];

/**
 * Retorno do login (cadastre igual no Entra, plataforma "Aplicativos móveis e de área de trabalho").
 * O login roda numa WebView do app, que intercepta a navegação para esta URI — funciona
 * igual no Expo Go e nos builds, sem depender de esquema próprio nem do IP do Metro.
 */
export const MICROSOFT_REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient';

/** Nome do arquivo local (cópia de trabalho do banco do OneDrive). */
export const LOCAL_DB_NAME = 'myfinances.sqlite';

/** Intervalo para conferir se o arquivo mudou no OneDrive com o app aberto. */
export const REMOTE_CHECK_INTERVAL_MS = 30 * 1000;
/** Espera após uma alteração antes de enviar (agrupa várias edições seguidas). */
export const PUSH_DEBOUNCE_MS = 1500;
/** Presença (.lock): mesma regra do desktop — atualiza a cada 60 s, expira em 3 min. */
export const LOCK_HEARTBEAT_MS = 60 * 1000;
export const LOCK_STALE_MS = 3 * 60 * 1000;
