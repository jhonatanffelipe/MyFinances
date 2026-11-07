import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState as RNAppState } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { IDLE_SYNC_STATUS, INITIAL_APP_STATE, type AppState, type SyncStatusView } from '@myfinances/core';
import { appSession } from '../engine/session';

interface AppStateContextValue {
  state: AppState;
  sync: SyncStatusView;
  /** Incrementa quando chegam dados de OUTRO aparelho (a tela atual recarrega). */
  dataVersion: number;
  /** Aplica um estado devolvido por uma ação (login, criar família...). */
  apply: (state: AppState) => void;
  /** Visão ativa (dashboard e lançamentos): null = Família. Volta para Família ao trocar de família. */
  viewMemberId: string | null;
  setViewMemberId: (memberId: string | null) => void;
  /** Sai da conta; com alterações não enviadas, pede confirmação antes. */
  requestSignOut: (options?: { forgetConnection?: boolean }) => Promise<void>;
  notify: (message: string) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL_APP_STATE);
  const [sync, setSync] = useState<SyncStatusView>(IDLE_SYNC_STATUS);
  const [dataVersion, setDataVersion] = useState(0);
  const [view, setView] = useState<{ familyId: string | null; memberId: string | null }>({ familyId: null, memberId: null });
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const offs = [
      appSession.onState(setState),
      appSession.onSyncStatus(setSync),
      appSession.onDataChanged(() => setDataVersion((v) => v + 1)),
    ];
    if (!started.current) {
      started.current = true;
      appSession.init().catch((err) => {
        console.error('[app] falha ao iniciar', err);
        setNotice(err?.message ?? 'Falha ao iniciar');
      });
    }
    // Foreground: renova o token, reassina o Realtime e busca novidades.
    // Background: envia o que falta e para a renovação/Realtime.
    const appStateSub = RNAppState.addEventListener('change', (next) => {
      if (next === 'active') appSession.resume();
      else if (next === 'background') appSession.pause().catch(() => undefined);
    });
    return () => {
      offs.forEach((off) => off());
      appStateSub.remove();
    };
  }, []);

  const viewMemberId =
    view.familyId === state.activeFamilyId && state.members.some((m) => m.user_id === view.memberId) ? view.memberId : null;
  const setViewMemberId = useCallback(
    (memberId: string | null) => setView({ familyId: state.activeFamilyId, memberId }),
    [state.activeFamilyId],
  );

  const requestSignOut = useCallback(async (options: { forgetConnection?: boolean } = {}) => {
    const run = async () => {
      setState(options.forgetConnection ? await appSession.forgetConnection() : await appSession.signOut(true));
    };
    const pending = await appSession.pendingChanges().catch(() => 0);
    if (pending === 0) return run();
    Alert.alert(
      'Sair com alterações não enviadas?',
      `Há ${pending} alteração(ões) feitas neste celular que ainda não chegaram ao banco. Conecte-se à internet e aguarde a sincronização para não perdê-las.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair mesmo assim', style: 'destructive', onPress: () => run().catch((err) => setNotice(err?.message)) },
      ],
    );
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({ state, sync, dataVersion, apply: setState, viewMemberId, setViewMemberId, requestSignOut, notify: setNotice }),
    [state, sync, dataVersion, viewMemberId, setViewMemberId, requestSignOut],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
      <Snackbar visible={!!notice} onDismiss={() => setNotice(null)} duration={5000} action={{ label: 'OK', onPress: () => setNotice(null) }}>
        {notice ?? ''}
      </Snackbar>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState fora do AppStateProvider');
  return ctx;
}

/** Core da família ativa (use cases de dados). */
export function useCore() {
  return appSession.core();
}

export function useCanManageFamily() {
  const { state } = useAppState();
  return state.role === 'OWNER' || state.role === 'ADMIN';
}
