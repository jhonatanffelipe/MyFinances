import React, { useState } from 'react';
import { Wallet, Database, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

interface RegisterUserViewProps {
  dbPath: string;
  loading: boolean;
  onRegister: (name: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  onBackToFolderSelection: () => void;
}

export function RegisterUserView({
  dbPath,
  loading,
  onRegister,
  onBackToFolderSelection,
}: RegisterUserViewProps) {
  const [name, setName] = useState('Carlos Silva');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Informe seu nome de usuário');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    try {
      setSubmitting(true);
      const result = await onRegister(name.trim(), password);
      if (!result.success) {
        setError(result.error || 'Erro ao registrar usuário');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
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
          Crie seu Usuário Local
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mb-6">
          Para garantir total soberania dos seus dados, a criptografia e controle de acesso
          são gerenciados no seu próprio dispositivo.
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
              Nome do Usuário
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Silva"
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Confirmar Senha
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Validation Rules */}
          <div className="text-xs space-y-0.5 pt-1 pb-2">
            <p className="text-emerald-600 font-medium">Mínimo de 8 caracteres</p>
            <p className="text-slate-400">Letras, números e caracteres especiais</p>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-2">
            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Criando usuário...</span>
                </>
              ) : (
                'Criar usuário e continuar'
              )}
            </button>

            <button
              type="button"
              onClick={onBackToFolderSelection}
              disabled={submitting || loading}
              className="w-full py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
            >
              Voltar para Seleção de Pasta
            </button>
          </div>
        </form>

        {/* Footnote */}
        <p className="text-xs text-slate-400 mt-6 leading-relaxed max-w-sm">
          Nenhum dado é enviado para a nuvem. Suas credenciais serão validadas diretamente contra o arquivo SQLite selecionado acima.
        </p>
      </div>
    </div>
  );
}
