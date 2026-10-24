import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { DbDevicePresence, DbSyncEvent } from '../interfaces/IElectronBridge';

interface DbSyncContextValue {
  /** Incrementa sempre que o banco é recarregado a partir de outro dispositivo. */
  dataVersion: number;
  /** Outro dispositivo com o mesmo banco aberto no momento (ou null). */
  otherDevice: DbDevicePresence | null;
}

const DbSyncContext = createContext<DbSyncContextValue>({ dataVersion: 0, otherDevice: null });

interface Notice {
  severity: 'info' | 'warning';
  message: string;
}

function fileName(fullPath: string | null): string {
  if (!fullPath) return '';
  return fullPath.split(/[\\/]/).pop() || fullPath;
}

/**
 * Escuta os eventos de sincronização do arquivo do banco (OneDrive) enviados pelo
 * processo principal: recarrega as telas quando chega uma versão de outro dispositivo
 * e avisa quando uma gravação local entrou em conflito.
 */
export function DbSyncProvider({ children }: { children: React.ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);
  const [otherDevice, setOtherDevice] = useState<DbDevicePresence | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onDbSyncEvent) return;

    api
      .getDbSyncStatus()
      .then((status) => setOtherDevice(status.otherDevice))
      .catch(() => {});

    const unsubscribe = api.onDbSyncEvent((event: DbSyncEvent) => {
      if (event.type === 'reloaded') {
        setDataVersion((v) => v + 1);
        setNotice({
          severity: 'info',
          message: 'Dados atualizados com alterações feitas em outro dispositivo.',
        });
      } else if (event.type === 'conflict') {
        setDataVersion((v) => v + 1);
        const copy = fileName(event.conflictCopyPath);
        setNotice({
          severity: 'warning',
          message:
            'O banco foi alterado em outro dispositivo e sua última alteração não foi gravada. ' +
            'Os dados foram atualizados; confira e refaça a alteração se necessário.' +
            (copy ? ` Uma cópia da sua versão foi salva em "${copy}".` : ''),
        });
      } else if (event.type === 'presence') {
        setOtherDevice(event.otherDevice);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <DbSyncContext.Provider value={{ dataVersion, otherDevice }}>
      {children}
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={notice?.severity === 'warning' ? null : 5000}
        onClose={(_e, reason) => {
          if (reason !== 'clickaway') setNotice(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            variant="filled"
            onClose={() => setNotice(null)}
            className="max-w-md text-xs"
          >
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </DbSyncContext.Provider>
  );
}

export function useDbSync() {
  return useContext(DbSyncContext);
}
