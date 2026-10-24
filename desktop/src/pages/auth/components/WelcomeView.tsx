import React from 'react';
import { ShieldCheck, Database, Folder, Loader2, AlertCircle } from 'lucide-react';

interface WelcomeViewProps {
  selecting: boolean;
  error?: string | null;
  onSelectFolder: () => void;
  onSelectFile: () => void;
}

export function WelcomeView({ selecting, error, onSelectFolder, onSelectFile }: WelcomeViewProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50/50">
      <div className="w-full max-w-lg bg-white rounded-3xl p-10 shadow-sm border border-slate-100 flex flex-col items-center text-center animate-fade-in">
        {/* Top Shield Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-6 shadow-sm">
          <ShieldCheck className="w-8 h-8" strokeWidth={2} />
        </div>

        {/* Title & Description */}
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">
          Boas-vindas ao MyFinances
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mb-8">
          Sua ferramenta profissional e definitiva para controle financeiro pessoal.
          Nossos servidores não armazenam seus dados. Para garantir total privacidade,
          suas informações serão salvas localmente em um banco de dados SQLite.
        </p>

        {/* Why SQLite Info Box */}
        <div className="w-full bg-slate-50/80 border border-slate-100 rounded-2xl p-4 flex items-start gap-4 text-left mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Por que SQLite?</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              É uma solução leve, segura, rápida e amplamente compatível. Você tem controle total sobre o arquivo.
            </p>
          </div>
        </div>

        {error && (
          <div className="w-full mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons: Create New Folder or Select Existing File */}
        <div className="w-full space-y-3">
          <button
            onClick={onSelectFolder}
            disabled={selecting}
            className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {selecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Abrindo seletor...</span>
              </>
            ) : (
              <>
                <Folder className="w-5 h-5" />
                <span>Selecionar Pasta do Banco de Dados</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onSelectFile}
            disabled={selecting}
            className="w-full py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
          >
            <Database className="w-4 h-4 text-slate-500" />
            <span>Selecionar Banco de Dados Existente (.sqlite)</span>
          </button>
        </div>

        {/* Footnote */}
        <p className="text-xs text-slate-400 mt-6 leading-relaxed">
          Ao selecionar uma pasta, o arquivo <span className="font-mono font-medium text-slate-500">db_myfinances.sqlite</span> será criado ou carregado automaticamente.
        </p>
      </div>
    </div>
  );
}
