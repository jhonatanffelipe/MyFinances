import React, { createContext, useContext, useEffect, useState } from 'react';
import { Snackbar } from 'react-native-paper';
import { SyncState, getSyncState, startSync, subscribeSync } from '../sync/syncManager';

interface SyncContextValue {
  sync: SyncState;
  /** Muda quando o banco é recarregado a partir de outro dispositivo (telas recarregam). */
  dataVersion: number;
  ready: boolean;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [sync, setSync] = useState<SyncState>(getSyncState());
  const [dataVersion, setDataVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSync((event) => {
      if (event.type === 'state') {
        setSync(event.state);
      } else if (event.type === 'reloaded') {
        setDataVersion((v) => v + 1);
        setNotice('Dados atualizados com alterações de outro dispositivo.');
      } else if (event.type === 'conflict') {
        setDataVersion((v) => v + 1);
        setNotice(
          'O banco foi alterado em outro dispositivo e sua última alteração não foi enviada. ' +
            'Confira os dados e refaça se necessário.' +
            (event.conflictCopyName ? ` Sua versão foi salva no OneDrive como "${event.conflictCopyName}".` : '')
        );
      }
    });
    startSync()
      .catch((err) => console.error('[Sync] falha ao iniciar', err))
      .finally(() => {
        setSync(getSyncState());
        setReady(true);
      });
    return unsubscribe;
  }, []);

  return (
    <SyncContext.Provider value={{ sync, dataVersion, ready }}>
      {children}
      <Snackbar
        visible={Boolean(notice)}
        onDismiss={() => setNotice(null)}
        duration={notice && notice.length > 80 ? 10000 : 5000}
        action={{ label: 'OK', onPress: () => setNotice(null) }}
      >
        {notice || ''}
      </Snackbar>
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync fora do SyncProvider');
  return ctx;
}
