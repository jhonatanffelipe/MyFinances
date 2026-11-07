import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { AlertTriangle, X } from 'lucide-react';
import { CreditCard } from '../../../types/database';
import { BulkDeleteCardPreview } from '../../../interfaces/IElectronBridge';

interface BulkDeleteCardModalProps {
  open: boolean;
  creditCards: CreditCard[];
  /** Cartão pré-selecionado ao abrir (ex.: a partir da linha da fatura). */
  initialCardId?: string | null;
  /** Mês pré-selecionado no formato YYYY-MM. */
  initialYearMonth?: string;
  onClose: () => void;
  /** Executa a exclusão; deve resolver após recarregar a listagem. */
  onConfirm: (creditCardId: string, yearMonth: string) => Promise<void>;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function BulkDeleteCardModal({
  open,
  creditCards,
  initialCardId,
  initialYearMonth,
  onClose,
  onConfirm,
}: BulkDeleteCardModalProps) {
  const [cardId, setCardId] = useState<string>('');
  const [yearMonth, setYearMonth] = useState<string>(dayjs().format('YYYY-MM'));
  const [preview, setPreview] = useState<BulkDeleteCardPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reinicia os campos sempre que o modal é aberto
  useEffect(() => {
    if (!open) return;
    setCardId(initialCardId ?? creditCards[0]?.id ?? '');
    setYearMonth(initialYearMonth || dayjs().format('YYYY-MM'));
    setError(null);
  }, [open, initialCardId, initialYearMonth, creditCards]);

  // Atualiza a prévia (quantidade e totais) ao trocar cartão ou mês
  useEffect(() => {
    if (!open || !cardId || !/^\d{4}-\d{2}$/.test(yearMonth) || !window.electronAPI) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    window.electronAPI
      .previewBulkDeleteCardMovements({ creditCardId: cardId, yearMonth })
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Erro ao carregar prévia');
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cardId, yearMonth]);

  const selectedCard = creditCards.find((c) => c.id === cardId);
  const monthLabel = dayjs(`${yearMonth}-01`).isValid()
    ? dayjs(`${yearMonth}-01`).locale('pt-br').format('MMMM [de] YYYY')
    : yearMonth;
  const canDelete = Boolean(cardId) && Boolean(preview && preview.count > 0) && !deleting && !loadingPreview;

  const handleConfirm = async () => {
    if (!cardId || !preview || preview.count === 0) return;
    try {
      setDeleting(true);
      setError(null);
      await onConfirm(cardId, yearMonth);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir lançamentos');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={deleting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}
    >
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div>
          <DialogTitle className="p-0 font-bold text-xl text-slate-900 leading-tight">
            Excluir lançamentos do cartão
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Remove de uma vez todos os lançamentos do cartão no mês escolhido.
          </p>
        </div>
        <IconButton
          size="small"
          onClick={onClose}
          disabled={deleting}
          className="text-slate-400 hover:text-slate-700"
        >
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      <DialogContent className="space-y-4 px-6 pt-3 pb-4">
        <FormControl size="small" fullWidth>
          <InputLabel className="text-xs">Cartão</InputLabel>
          <Select
            value={cardId}
            label="Cartão"
            onChange={(e) => setCardId(String(e.target.value ?? ''))}
            className="rounded-xl text-xs"
          >
            {creditCards.map((card) => (
              <MenuItem key={card.id} value={card.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                    style={{ backgroundColor: card.color || '#8b5cf6' }}
                  />
                  <span>{card.description}</span>
                </span>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <DatePicker
          label="Mês dos lançamentos"
          views={['year', 'month']}
          openTo="month"
          format="MM/YYYY"
          value={dayjs(`${yearMonth}-01`)}
          onChange={(val) => {
            if (val && val.isValid()) setYearMonth(val.format('YYYY-MM'));
          }}
          slotProps={{
            textField: {
              size: 'small',
              fullWidth: true,
              InputProps: { className: 'rounded-xl text-xs' },
            },
          }}
        />

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 min-h-[76px] flex items-center">
          {loadingPreview ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CircularProgress size={14} /> Calculando lançamentos...
            </div>
          ) : !cardId ? (
            <p className="text-xs text-slate-500">Cadastre ou selecione um cartão.</p>
          ) : preview && preview.count > 0 ? (
            <div className="space-y-1 text-xs text-slate-700">
              <p>
                <span className="font-bold text-slate-900">{preview.count} lançamento(s)</span> de{' '}
                <span className="font-semibold">{selectedCard?.description}</span> em{' '}
                <span className="font-semibold">{monthLabel}</span>
              </p>
              <p>
                Saídas: <span className="font-mono font-bold">{formatCurrency(preview.totalExpense)}</span>
                {preview.totalIncome > 0 && (
                  <>
                    {' · '}Entradas:{' '}
                    <span className="font-mono font-bold text-emerald-700">
                      {formatCurrency(preview.totalIncome)}
                    </span>
                  </>
                )}
              </p>
              {preview.members.length > 0 && (
                <p>
                  De:{' '}
                  {preview.members.map((m, i) => (
                    <span key={m.member_id}>
                      {i > 0 && ', '}
                      <span className="font-semibold text-slate-900">{m.name ?? 'membro desconhecido'}</span> ({m.count})
                    </span>
                  ))}
                </p>
              )}
              {preview.fixedCount > 0 && (
                <p className="text-amber-700">
                  Inclui {preview.fixedCount} lançamento(s) gerado(s) por despesas fixas.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Nenhum lançamento deste cartão em {monthLabel}.
            </p>
          )}
        </div>

        {preview && preview.count > 0 && (
          <div className="flex items-start gap-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-xl p-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Esta ação não pode ser desfeita.</span>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </DialogContent>

      <DialogActions className="px-6 pb-5 pt-2 border-t border-slate-100 flex justify-end gap-2">
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
          disabled={deleting}
          className="rounded-xl normal-case font-semibold text-slate-600 border-slate-200"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!canDelete}
          className="rounded-xl normal-case font-bold bg-red-600 hover:bg-red-700 text-white shadow-none"
        >
          {deleting
            ? 'Excluindo...'
            : preview && preview.count > 0
              ? `Excluir ${preview.count} lançamento(s)`
              : 'Excluir'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
