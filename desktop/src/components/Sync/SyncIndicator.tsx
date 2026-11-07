import { useState } from 'react';
import { AlertTriangle, CloudOff, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { SyncDetailsDialog } from './SyncDetailsDialog';

export function timeAgo(iso: string | null) {
  if (!iso) return 'nunca';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Rodapé da barra lateral: online/offline, sincronizando, N pendentes, erro. Clique abre os detalhes. */
export function SyncIndicator() {
  const { sync, state } = useAppState();
  const [open, setOpen] = useState(false);
  const offline = !state.online || sync.phase === 'offline';

  let dot = 'bg-emerald-400 shadow-emerald-500/50';
  let Icon = CheckCircle2;
  let title = 'Sincronizado';
  let detail = `Última vez ${timeAgo(sync.lastSyncAt)}`;

  if (sync.failed > 0) {
    dot = 'bg-amber-400 shadow-amber-500/50';
    Icon = AlertTriangle;
    title = `${sync.failed} alteração(ões) recusada(s)`;
    detail = 'Clique para ver e resolver';
  } else if (offline) {
    dot = 'bg-slate-400';
    Icon = CloudOff;
    title = 'Offline';
    detail = sync.pending > 0 ? `${sync.pending} pendente(s) · sobem quando voltar a internet` : 'Tudo salvo neste computador';
  } else if (sync.phase === 'syncing') {
    dot = 'bg-sky-400 shadow-sky-500/50 animate-pulse';
    Icon = Loader2;
    title = 'Sincronizando...';
    detail = sync.pending > 0 ? `${sync.pending} pendente(s)` : 'Buscando novidades';
  } else if (sync.phase === 'error') {
    dot = 'bg-red-400 shadow-red-500/50';
    Icon = AlertTriangle;
    title = 'Erro ao sincronizar';
    detail = sync.lastError ?? 'Tentando de novo em instantes';
  } else if (sync.pending > 0) {
    dot = 'bg-sky-400';
    Icon = RefreshCw;
    title = `${sync.pending} pendente(s)`;
    detail = 'Enviando em instantes';
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={sync.lastError ?? undefined}
        className="w-full text-left bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800/80 rounded-2xl p-3 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shadow-sm ${dot}`} />
          <span className="text-xs font-bold text-white flex-1 truncate">{title}</span>
          <Icon className={`w-3.5 h-3.5 text-slate-400 ${sync.phase === 'syncing' && !offline ? 'animate-spin' : ''}`} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1 truncate">{detail}</p>
      </button>
      <SyncDetailsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
