import { useEffect, useRef, useState } from 'react';
import { LinearProgress } from '@mui/material';
import { AlertTriangle, CheckCircle2, CloudUpload, Database, FileUp } from 'lucide-react';
import { MemberSelect } from '../Members/MemberSelect';
import { useAppState } from '../../contexts/AppStateContext';
import type { V1FileView, V1ImportProgress, V1ImportReport } from '../../interfaces/AppBridge';

const STEP_LABEL: Record<V1ImportProgress['step'], string> = {
  categories: 'Categorias',
  credit_cards: 'Cartões',
  fixed_expenses: 'Lançamentos fixos',
  fixed_expense_payments: 'Baixas dos fixos',
  movements: 'Lançamentos',
};

const formatDate = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Importar o banco da v1: escolher o db_myfinances.sqlite → prévia (e a quem atribuir o
 * histórico) → gravação local com progresso → relatório + envio ao banco da família.
 */
export function ImportV1Wizard({ onDone }: { onDone: () => void }) {
  const { state, sync } = useAppState();
  const [file, setFile] = useState<V1FileView | null>(null);
  const [memberId, setMemberId] = useState(state.user?.id ?? '');
  const [progress, setProgress] = useState<V1ImportProgress | null>(null);
  const [report, setReport] = useState<V1ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toSend = useRef(0);

  useEffect(() => window.appAPI.onV1Progress(setProgress), []);
  // Sai sem importar: descarta a cópia em memória do arquivo
  useEffect(() => () => void window.appAPI.cancelV1Import().catch(() => undefined), []);

  const choose = async () => {
    setError(null);
    setBusy(true);
    try {
      const picked = await window.appAPI.selectV1File();
      if (picked) setFile(picked);
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível abrir o arquivo');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await window.appAPI.importV1(memberId || null);
      toSend.current = (await window.appAPI.getSyncStatus()).pending;
      setReport(result);
      window.appAPI.syncNow().catch(() => undefined);
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível importar');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const errorBox = error ? (
    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      {error}
    </div>
  ) : null;

  // ---------------------------------------------------------------- relatório + envio
  if (report) {
    const imported = Object.values(report.imported).reduce((a, b) => a + b, 0);
    const existing = Object.values(report.existing).reduce((a, b) => a + b, 0);
    const offline = !state.online || sync.phase === 'offline';
    const sent = toSend.current ? Math.max(0, toSend.current - sync.pending) : 0;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Importação concluída</p>
            <p className="text-xs mt-0.5">
              {report.imported.movements} lançamento(s), {report.imported.fixed_expenses} fixo(s), {report.imported.categories} categoria(s) e{' '}
              {report.imported.credit_cards} cartão(ões) novos. {existing > 0 ? `${existing} já estavam na família e foram ignorados.` : ''}
              {imported === 0 && existing > 0 ? ' Este banco já tinha sido importado.' : ''}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <CloudUpload className="w-4 h-4 text-emerald-600" /> Envio ao banco da família
          </p>
          {toSend.current === 0 || sync.pending === 0 ? (
            <p className="text-xs text-emerald-700">Tudo enviado. Os outros aparelhos recebem na próxima sincronização.</p>
          ) : offline ? (
            <p className="text-xs text-slate-500">Sem internet: {sync.pending} alteração(ões) ficam neste computador e sobem quando a conexão voltar.</p>
          ) : (
            <>
              <LinearProgress variant="determinate" value={(sent / toSend.current) * 100} color="success" className="rounded-full h-2" />
              <p className="text-xs text-slate-500">
                Enviando {sent} de {toSend.current}…
              </p>
            </>
          )}
        </div>

        {report.problems.length > 0 && (
          <details className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 text-xs text-amber-900">
            <summary className="font-bold cursor-pointer">{report.problems.length} registro(s) com problema</summary>
            <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {report.problems.slice(0, 200).map((p, i) => (
                <li key={i}>
                  {STEP_LABEL[p.table]} #{p.oldId}: {p.reason}
                </li>
              ))}
            </ul>
          </details>
        )}

        <button type="button" onClick={onDone} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer">
          Ir para o app
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------- gravando
  if (busy && file) {
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm font-semibold text-slate-700">Importando {progress ? STEP_LABEL[progress.step].toLowerCase() : ''}…</p>
        <LinearProgress
          variant={progress && progress.total ? 'determinate' : 'indeterminate'}
          value={progress && progress.total ? (progress.done / progress.total) * 100 : undefined}
          color="success"
          className="rounded-full h-2"
        />
        {progress && progress.step === 'movements' && (
          <p className="text-xs text-slate-500">
            {progress.done} de {progress.total} lançamentos
          </p>
        )}
        <p className="text-[11px] text-slate-400">Funciona sem internet: os dados entram neste computador e são enviados depois.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------- prévia
  if (file) {
    const p = file.preview;
    const rows: Array<[string, number]> = [
      ['Lançamentos', p.movements],
      ['Lançamentos fixos', p.fixedExpenses],
      ['Baixas dos fixos', p.payments],
      ['Categorias', p.categories],
      ['Cartões', p.creditCards],
    ];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
          <Database className="w-5 h-5 text-slate-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 truncate">{file.fileName}</p>
            <p className="text-xs text-slate-500">
              {p.period ? `De ${formatDate(p.period.start)} a ${formatDate(p.period.end)}` : 'Sem lançamentos'}
            </p>
          </div>
          <button type="button" onClick={choose} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">
            Trocar
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {rows.map(([label, n]) => (
            <div key={label} className="p-3 rounded-xl border border-slate-100 text-center">
              <p className="text-lg font-extrabold text-slate-900">{n}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Atribuir o histórico a</label>
          <MemberSelect value={memberId} onChange={setMemberId} />
          <p className="text-[11px] text-slate-400 mt-1.5">A v1 não registra quem lançou: tudo fica no nome de quem você escolher.</p>
        </div>
        <ul className="text-[11px] text-slate-500 space-y-1 list-disc list-inside">
          <li>Categorias e cartões com o mesmo nome dos que já existem são reaproveitados.</li>
          <li>Importar o mesmo arquivo de novo não duplica nada (só traz o que for novo).</li>
          <li>O arquivo original não é alterado.</li>
        </ul>
        {errorBox}
        <button
          type="button"
          onClick={run}
          disabled={busy || p.movements + p.fixedExpenses + p.categories + p.creditCards === 0}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 cursor-pointer"
        >
          Importar
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------- escolher arquivo
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Escolha o <strong>db_myfinances.sqlite</strong> que você usava na v1 (fica na pasta que você escolheu ao configurar a v1). Os
        lançamentos, fixos, categorias e cartões entram nesta família.
      </p>
      {errorBox}
      <button
        type="button"
        onClick={choose}
        disabled={busy}
        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        <FileUp className="w-4 h-4" /> Escolher arquivo da v1
      </button>
    </div>
  );
}
