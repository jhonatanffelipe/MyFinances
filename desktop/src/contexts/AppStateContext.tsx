import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { AppState, PairingRequestView, SyncStatusView } from '../interfaces/AppBridge';

interface AppStateContextValue {
  state: AppState;
  sync: SyncStatusView;
  /** Incrementa quando chegam dados de OUTRO aparelho (a tela atual recarrega). */
  dataVersion: number;
  /** Pedido de "Conectar celular" aguardando Permitir/Negar. */
  pairingRequest: PairingRequestView | null;
  showPairingRequest: (request: PairingRequestView) => void;
  dismissPairingRequest: () => void;
  /** Aplica um estado devolvido por uma ação (login, criar família...). */
  apply: (state: AppState) => void;
  refresh: () => Promise<void>;
  /**
   * Sai da conta. Se houver alterações ainda não enviadas, pede confirmação antes
   * (sair descarta o banco local deste usuário). Com `forgetConnection`, também
   * esquece o banco conectado.
   */
  requestSignOut: (options?: { forgetConnection?: boolean }) => Promise<void>;
}

const LOADING: AppState = {
  phase: 'loading',
  connection: null,
  user: null,
  families: [],
  activeFamilyId: null,
  role: null,
  members: [],
  pendingInvite: null,
  online: true,
};

const IDLE_SYNC: SyncStatusView = {
  phase: 'idle',
  pending: 0,
  failed: 0,
  lastSyncAt: null,
  lastError: null,
  lastConflicts: 0,
  pulledRows: 0,
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

/** Estado da v2 vindo do processo main: fase (conectar/login/família/pronto), usuário, família e sync. */
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(LOADING);
  const [sync, setSync] = useState<SyncStatusView>(IDLE_SYNC);
  const [dataVersion, setDataVersion] = useState(0);
  const [pairingRequest, setPairingRequest] = useState<PairingRequestView | null>(null);
  const [signOutConfirm, setSignOutConfirm] = useState<{ pending: number; forgetConnection: boolean } | null>(null);

  const refresh = useCallback(async () => {
    setState(await window.appAPI.getState());
    setSync(await window.appAPI.getSyncStatus());
  }, []);

  useEffect(() => {
    const api = window.appAPI;
    refresh().catch(() => undefined);
    const offs = [
      api.onStateChanged(setState),
      api.onSyncStatus(setSync),
      api.onDataChanged(() => setDataVersion((v) => v + 1)),
      api.onPairingRequest(setPairingRequest),
    ];
    return () => offs.forEach((off) => off());
  }, [refresh]);

  const signOutNow = useCallback(async (forgetConnection: boolean) => {
    const next = forgetConnection ? await window.appAPI.forgetConnection() : await window.appAPI.signOut(true);
    setState(next);
  }, []);

  const requestSignOut = useCallback(
    async (options: { forgetConnection?: boolean } = {}) => {
      const forgetConnection = !!options.forgetConnection;
      const pending = await window.appAPI.pendingChanges().catch(() => 0);
      if (pending > 0) {
        setSignOutConfirm({ pending, forgetConnection });
        return;
      }
      await signOutNow(forgetConnection);
    },
    [signOutNow],
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      sync,
      dataVersion,
      pairingRequest,
      showPairingRequest: setPairingRequest,
      dismissPairingRequest: () => setPairingRequest(null),
      apply: setState,
      refresh,
      requestSignOut,
    }),
    [state, sync, dataVersion, pairingRequest, refresh, requestSignOut],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!signOutConfirm}
        title="Sair com alterações não enviadas?"
        confirmLabel="Sair mesmo assim"
        danger
        onClose={() => setSignOutConfirm(null)}
        onConfirm={() => signOutNow(signOutConfirm?.forgetConnection ?? false)}
      >
        Há <strong className="text-slate-900">{signOutConfirm?.pending} alteração(ões)</strong> feitas neste computador que ainda não
        chegaram ao banco. Conecte-se à internet e aguarde a sincronização para não perdê-las.
      </ConfirmDialog>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState precisa estar dentro de AppStateProvider');
  return ctx;
}

/** Membros da família ativa (para os campos "De quem" e filtros). */
export function useMembers() {
  const { state } = useAppState();
  return state.members;
}

/** OWNER e ADMIN gerenciam membros e convites. */
export function useCanManageFamily() {
  const { state } = useAppState();
  return state.role === 'OWNER' || state.role === 'ADMIN';
}
