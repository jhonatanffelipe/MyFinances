import { exchangeCodeAsync, refreshAsync, TokenResponse } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { MICROSOFT_CLIENT_ID, MICROSOFT_DISCOVERY, MICROSOFT_SCOPES } from './config';

/** Tokens da conta Microsoft guardados no armazenamento seguro do aparelho. */
const TOKEN_KEY = 'myfinances.msTokens';

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch em ms em que o access token expira. */
  expiresAt: number;
}

let cache: StoredTokens | null = null;
let refreshing: Promise<string> | null = null;

export class NotSignedInError extends Error {
  constructor() {
    super('Conta Microsoft não conectada');
  }
}

async function save(tokens: StoredTokens | null) {
  cache = tokens;
  if (tokens) await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function load(): Promise<StoredTokens | null> {
  if (cache) return cache;
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  cache = raw ? (JSON.parse(raw) as StoredTokens) : null;
  return cache;
}

function fromResponse(res: TokenResponse, previousRefresh?: string): StoredTokens {
  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken || previousRefresh,
    expiresAt: (res.issuedAt || Math.floor(Date.now() / 1000)) * 1000 + (res.expiresIn || 3600) * 1000,
  };
}

export async function isSignedIn() {
  return Boolean((await load())?.refreshToken || (await load())?.accessToken);
}

/** Troca o código do login (PKCE, sem segredo) por tokens e salva. */
export async function completeSignIn(code: string, codeVerifier: string, redirectUri: string) {
  const res = await exchangeCodeAsync(
    {
      clientId: MICROSOFT_CLIENT_ID,
      code,
      redirectUri,
      scopes: MICROSOFT_SCOPES,
      extraParams: { code_verifier: codeVerifier },
    },
    MICROSOFT_DISCOVERY
  );
  await save(fromResponse(res));
}

/** Retorna um access token válido, renovando com o refresh token quando necessário. */
export async function getAccessToken(): Promise<string> {
  const tokens = await load();
  if (!tokens) throw new NotSignedInError();
  if (tokens.expiresAt - Date.now() > 60 * 1000) return tokens.accessToken;
  if (!tokens.refreshToken) throw new NotSignedInError();

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await refreshAsync(
          { clientId: MICROSOFT_CLIENT_ID, refreshToken: tokens.refreshToken!, scopes: MICROSOFT_SCOPES },
          MICROSOFT_DISCOVERY
        );
        const next = fromResponse(res, tokens.refreshToken);
        await save(next);
        return next.accessToken;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function signOut() {
  await save(null);
}
