import { useCallback, useEffect, useRef, useState } from 'react';
import { CircularProgress, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { RefreshCw, Smartphone, X } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import type { DeviceLinkView } from '../../interfaces/AppBridge';

/** Enquanto o QR está na tela, consulta pedidos pendentes (caso o Realtime não chegue). */
const PENDING_POLL_MS = 3_000;

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * QR "Conectar celular": o celular lê o código e escolhe "Sou eu" (pareamento,
 * aprovado aqui) ou "Sou outra pessoa" (convite). O QR expira e é regenerado sozinho.
 */
export function ConnectPhoneDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, showPairingRequest } = useAppState();
  const [link, setLink] = useState<DeviceLinkView | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);

  const generate = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const next = await window.appAPI.createDeviceLink();
      if (gen !== generation.current) return;
      setLink(next);
      setRemaining(next.expiresIn);
    } catch (err: any) {
      if (gen === generation.current) {
        setLink(null);
        setError(err?.message ?? 'Não foi possível gerar o QR');
      }
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      generation.current++;
      setLink(null);
      setError(null);
      return;
    }
    generate();
  }, [open, generate]);

  // Contagem regressiva; ao zerar, gera outro QR
  useEffect(() => {
    if (!open || !link) return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          generate();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [open, link, generate]);

  // Fallback do Realtime: pedidos aguardando aprovação
  useEffect(() => {
    if (!open || !link) return;
    const timer = setInterval(async () => {
      const pending = await window.appAPI.pendingPairings().catch(() => []);
      if (pending.length > 0) showPairingRequest(pending[0]);
    }, PENDING_POLL_MS);
    return () => clearInterval(timer);
  }, [open, link, showPairingRequest]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}>
      <div className="flex items-center justify-between px-6 pt-4">
        <DialogTitle className="p-0 font-bold text-xl text-slate-900 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-emerald-600" /> Conectar celular
        </DialogTitle>
        <IconButton size="small" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </IconButton>
      </div>
      <DialogContent className="px-6 pt-3 pb-6 flex flex-col items-center text-center gap-4">
        <ol className="text-xs text-slate-600 text-left list-decimal list-inside space-y-1 self-stretch bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
          <li>Instale e abra o MyFinances no celular.</li>
          <li>
            Toque em <strong>Ler QR do computador</strong> e aponte para o código abaixo.
          </li>
          <li>
            Escolha <strong>Sou eu</strong> (sua conta, sem senha) ou <strong>Sou outra pessoa</strong> (convite para a família).
          </li>
        </ol>

        <div className="w-64 h-64 rounded-2xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
          {loading && !link ? (
            <CircularProgress color="success" />
          ) : link ? (
            <img src={link.qrDataUrl} alt="QR para conectar o celular" className={`w-full h-full ${loading ? 'opacity-30' : ''}`} />
          ) : (
            <p className="text-xs text-slate-400 px-6">{state.online ? 'QR indisponível' : 'Sem internet: o QR precisa de conexão.'}</p>
          )}
        </div>

        {link && (
          <p className="text-xs text-slate-500">
            Expira em <span className="font-mono font-bold text-slate-800">{formatCountdown(remaining)}</span> · um novo QR é gerado
            automaticamente.
          </p>
        )}
        {link && !link.canInvite && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
            Só quem administra a família pode convidar outra pessoa. Este QR serve apenas para conectar o seu celular.
          </p>
        )}
        {error && <p className="text-xs text-red-600 whitespace-pre-line">{error}</p>}

        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Gerar outro QR
        </button>
      </DialogContent>
    </Dialog>
  );
}
