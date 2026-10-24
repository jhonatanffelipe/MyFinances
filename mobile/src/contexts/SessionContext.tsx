import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppUser } from '../data/types';
import { getUser } from '../data/repositories/auth';
import { useSync } from './SyncContext';

/**
 * Sessão do usuário local (os mesmos usuários/senhas do desktop).
 * Com "manter conectado", o id fica no armazenamento seguro do aparelho.
 */
const REMEMBER_KEY = 'myfinances.rememberedUserId';

interface SessionValue {
  user: AppUser | null;
  restoring: boolean;
  signIn: (user: AppUser, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { sync } = useSync();
  const [user, setUser] = useState<AppUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    if (!sync.dbReady) {
      if (!sync.remote) setRestoring(false);
      return;
    }
    if (user) {
      setRestoring(false);
      return;
    }
    (async () => {
      try {
        const id = await SecureStore.getItemAsync(REMEMBER_KEY);
        if (id) {
          const remembered = await getUser(Number(id));
          if (remembered) setUser(remembered);
        }
      } catch (err) {
        console.warn('[Sessão] falha ao restaurar', err);
      } finally {
        setRestoring(false);
      }
    })();
  }, [sync.dbReady, sync.remote, user]);

  const signIn = useCallback(async (u: AppUser, remember: boolean) => {
    if (remember) await SecureStore.setItemAsync(REMEMBER_KEY, String(u.id));
    else await SecureStore.deleteItemAsync(REMEMBER_KEY);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(REMEMBER_KEY);
    setUser(null);
  }, []);

  return <SessionContext.Provider value={{ user, restoring, signIn, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fora do SessionProvider');
  return ctx;
}
