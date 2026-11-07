import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Smartphone } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';

/**
 * Diálogo global "Moto G quer conectar. Permitir / Negar", disparado pelo Realtime
 * em device_pairings. Some sozinho quando o pedido expira.
 */
export function PairingApprovalDialog() {
  const { pairingRequest, dismissPairingRequest, state } = useAppState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!pairingRequest) return;
    const ms = new Date(pairingRequest.expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      dismissPairingRequest();
      return;
    }
    const timer = setTimeout(dismissPairingRequest, ms);
    return () => clearTimeout(timer);
  }, [pairingRequest, dismissPairingRequest]);

  const familyName = state.families.find((f) => f.id === pairingRequest?.familyId)?.name;

  const resolve = async (approve: boolean) => {
    if (!pairingRequest) return;
    setBusy(true);
    setError(null);
    try {
      await window.appAPI.resolvePairing(pairingRequest.id, approve);
      dismissPairingRequest();
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível responder ao pedido');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!pairingRequest} maxWidth="xs" fullWidth PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}>
      <DialogTitle className="font-bold text-lg text-slate-900 flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-emerald-600" /> Conectar aparelho?
      </DialogTitle>
      <DialogContent className="text-sm text-slate-600 space-y-2">
        <p>
          <strong className="text-slate-900">{pairingRequest?.deviceName}</strong> quer entrar na sua conta
          {familyName ? (
            <>
              {' '}
              e ver a família <strong className="text-slate-900">{familyName}</strong>
            </>
          ) : null}
          .
        </p>
        <p className="text-xs text-slate-500">Só permita se for o seu celular e você acabou de ler o QR.</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </DialogContent>
      <DialogActions className="px-6 pb-5 pt-2 flex justify-end gap-2">
        <Button
          onClick={() => resolve(false)}
          variant="outlined"
          color="inherit"
          disabled={busy}
          className="rounded-xl normal-case font-semibold text-slate-600 border-slate-200"
        >
          Negar
        </Button>
        <Button
          onClick={() => resolve(true)}
          variant="contained"
          disabled={busy}
          className="rounded-xl normal-case font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
        >
          Permitir
        </Button>
      </DialogActions>
    </Dialog>
  );
}
