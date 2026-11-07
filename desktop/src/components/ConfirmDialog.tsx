import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  /** Botão vermelho. */
  danger?: boolean;
  /** Aviso em destaque (ex.: "não pode ser desfeita"). */
  warning?: React.ReactNode;
  onClose: () => void;
  /** Pode lançar: a mensagem aparece no diálogo e ele continua aberto. */
  onConfirm: () => Promise<void> | void;
}

/** Confirmação padrão do app (substitui o window.confirm). */
export function ConfirmDialog({ open, title, children, confirmLabel = 'Confirmar', danger, warning, onClose, onConfirm }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível concluir');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      TransitionProps={{ onExited: () => setError(null) }}
      PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}
    >
      <DialogTitle className="font-bold text-lg text-slate-900 pb-1">{title}</DialogTitle>
      <DialogContent className="space-y-3 text-sm text-slate-600">
        <div>{children}</div>
        {warning && (
          <div className="flex items-start gap-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-xl p-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </DialogContent>
      <DialogActions className="px-6 pb-5 pt-2 flex justify-end gap-2">
        <Button onClick={onClose} variant="outlined" color="inherit" disabled={busy} className="rounded-xl normal-case font-semibold text-slate-600 border-slate-200">
          Cancelar
        </Button>
        <Button
          onClick={confirm}
          variant="contained"
          disabled={busy}
          className={`rounded-xl normal-case font-bold text-white shadow-none ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {busy ? 'Aguarde...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
