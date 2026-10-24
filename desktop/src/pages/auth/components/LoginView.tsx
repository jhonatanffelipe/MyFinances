import React, { useState } from 'react';
import { Wallet, Database, Eye, EyeOff, Loader2, AlertCircle, UserPlus } from 'lucide-react';

interface LoginViewProps {
  dbPath: string;
  defaultUserName?: string | null;
  loading: boolean;
  onLogin: (name: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  onChangeFolder: () => void;
  onChangeFile?: () => void;
  onGoToRegister?: () => void;
}

export function LoginView({
  dbPath,
  defaultUserName,
  loading,
  onLogin,
  onChangeFolder,
  onChangeFile,
  onGoToRegister,
}: LoginViewProps) {
  const [name, setName] = useState(defaultUserName || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Informe seu nome de usuário');
      return;
    }
    if (!password) {
      setError('Informe sua senha');
      return;
    }

    try {
      setSubmitting(true);
      const result = await onLogin(name.trim(), password);
      if (!result.success) {
        setError(result.error || 'Usuário ou senha incorretos');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50/50">
      <div className="w-full max-w-lg bg-white rounded-3xl p-10 shadow-sm border border-slate-100 flex flex-col items-center text-center animate-fade-in">
        {/* Top Wallet Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-6 shadow-sm">
          <Wallet className="w-8 h-8" strokeWidth={2} />
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Entrar no MyFinances
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mb-6">
          Bem-vindo de volta! Insira suas credenciais locais para desbloquear e
          descriptografar sua carteira de movimentações.
        </p>

        {/* Linked Database Banner */}
        <div className="w-full bg-slate-50/80 border border-slate-100 rounded-2xl p-3.5 flex items-center gap-3.5 text-left mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider block">
              BANCO DE DADOS LOCAL VINCULADO
            </span>
            <span className="text-xs text-slate-500 font-mono truncate block" title={dbPath}>
              {dbPath}
            </span>
          </div>
        </div>

        {error && (
          <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nome de Usuário
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome de usuário"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-3">
            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                'Entrar'
              )}
            </button>

            {onGoToRegister && (
              <button
                type="button"
                onClick={onGoToRegister}
                disabled={submitting || loading}
                className="w-full py-2.5 px-6 rounded-xl border border-emerald-200/60 hover:bg-emerald-50 text-emerald-700 font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>Não possui conta? Criar novo usuário</span>
              </button>
            )}

            <button
              type="button"
              onClick={onChangeFolder}
              disabled={submitting || loading}
              className="w-full py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
            >
              Trocar pasta do banco de dados (SQLite)
            </button>

            {onChangeFile && (
              <button
                type="button"
                onClick={onChangeFile}
                disabled={submitting || loading}
                className="w-full py-2.5 px-6 rounded-xl border border-transparent hover:border-slate-200 text-slate-500 hover:text-slate-800 font-medium text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Selecionar arquivo .sqlite existente</span>
              </button>
            )}
          </div>
        </form>

        {/* Footnote */}
        <p className="text-xs text-slate-400 mt-6 leading-relaxed max-w-sm">
          A autenticação utiliza uma chave hash derivada salva localmente dentro do seu arquivo <span className="font-mono">db_myfinances.sqlite</span>.
        </p>
      </div>
    </div>
  );
}
