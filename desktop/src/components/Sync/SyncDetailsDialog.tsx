import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { RefreshCw, Trash2, X } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import type { SyncFailedItem } from '../../interfaces/AppBridge';
import { timeAgo } from './SyncIndicator';

const TABLE_LABEL: Record<string, string> = {
  movements: 'Lançamento',
  categories: 'Categoria',
  credit_cards: 'Cartão',
  fixed_expenses: 'Lançamento fixo',
  fixed_expense_payments: 'Baixa de lançamento fixo',
};

/** Detalhes da sincronização: forçar, e reenviar/descartar o que o servidor recusou. */
export function SyncDetailsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sync, state } = useAppState();
  const [failed, setFailed] = useState<SyncFailedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(await window.appAPI.listSyncFailed().catch(() => []));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load, sync.failed]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível sincronizar');
    } finally {
      setBusy(false);
    }
  };

  const offline = !state.online || sync.phase === 'offline';
  const rows: Array<[string, string]> = [
    ['Conexão', offline ? 'Offline' : 'Online'],
    ['Última sincronização', timeAgo(sync.lastSyncAt)],
    ['Alterações aguardando envio', String(sync.pending)],
    ['Recusadas pelo servidor', String(sync.failed)],
  ];
  if (sync.lastConflicts > 0) rows.push(['Conflitos no último envio', `${sync.lastConflicts} (vale a versão mais recente)`]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}>
      <div className="flex items-center justify-between px-6 pt-4">
        <DialogTitle className="p-0 font-bold text-xl text-slate-900">Sincronização</DialogTitle>
        <IconButton size="small" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </IconButton>
      </div>
      <DialogContent className="px-6 pt-3 space-y-4">
        <p className="text-xs text-slate-500">
          Tudo é salvo primeiro neste computador e enviado ao banco da família quando há internet. Sem internet, o app continua
          funcionando normalmente.
        </p>
        <div className="divide-y divide-slate-100 text-xs border border-slate-100 rounded-2xl px-4">
          {rows.map(([k, v]) => (
            <div key={k} className="py-2.5 flex justify-between gap-4">
              <span className="text-slate-500 font-medium">{k}</span>
              <span className="text-slate-800 font-semibold text-right">{v}</span>
            </div>
          ))}
        </div>
        {sync.lastError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-2.5 whitespace-pre-line">{sync.lastError}</p>
        )}

        {failed.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recusadas pelo servidor</h4>
            <p className="text-[11px] text-slate-500">
              Reenvie depois de corrigir o problema (ex.: rodar a migração do banco) ou descarte para desfazer a alteração local na
              próxima sincronização.
            </p>
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {failed.map((f) => (
                <div key={f.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">
                      {TABLE_LABEL[f.table_name] ?? f.table_name} · {f.attempts} tentativa(s)
                    </p>
                    <p className="text-slate-500 break-words">{f.last_error}</p>
                  </div>
                  <IconButton
                    size="small"
                    title="Descartar"
                    disabled={busy}
                    onClick={() => run(() => window.appAPI.discardSyncFailed(f.id))}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </DialogContent>
      <DialogActions className="px-6 pb-5 pt-2 flex justify-end gap-2">
        {failed.length > 0 && (
          <Button
            onClick={() => run(() => window.appAPI.retrySyncFailed())}
            variant="outlined"
            color="inherit"
            disabled={busy || offline}
            className="rounded-xl normal-case font-semibold text-slate-600 border-slate-200"
          >
            Reenviar recusadas
          </Button>
        )}
        <Button
          onClick={() => run(() => window.appAPI.syncNow())}
          variant="contained"
          disabled={busy || offline}
          startIcon={<RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />}
          className="rounded-xl normal-case font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
        >
          Sincronizar agora
        </Button>
      </DialogActions>
    </Dialog>
  );
}
