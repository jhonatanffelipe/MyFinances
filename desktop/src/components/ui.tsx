import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Wallet } from 'lucide-react';

/** Peças visuais das telas de entrada (mesmo estilo das telas da v1). */
export function Shell({
  icon: Icon = Wallet,
  title,
  subtitle,
  children,
  wide,
}: {
  icon?: React.ElementType;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50/50 overflow-y-auto">
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} bg-white rounded-3xl p-10 shadow-sm border border-slate-100 flex flex-col items-center text-center`}
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-6 shadow-sm">
          <Icon className="w-8 h-8" strokeWidth={2} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 leading-relaxed max-w-md mb-6">{subtitle}</p>}
        <div className="w-full text-left">{children}</div>
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2 text-left">
      <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
      <span className="whitespace-pre-line">{message}</span>
    </div>
  );
}

export function SuccessBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="w-full mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2 text-left">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all';

export function Field({
  label,
  hint,
  password,
  textarea,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: React.ReactNode; password?: boolean; textarea?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          {...(props as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          rows={4}
          className={`${inputClass} font-mono text-xs resize-none`}
        />
      ) : (
        <div className="relative">
          <input {...props} type={password ? (show ? 'text' : 'password') : props.type ?? 'text'} className={`${inputClass} ${password ? 'pr-10 font-mono' : ''}`} />
          {password && (
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}
      {hint && <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export function PrimaryButton({ loading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="w-full py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {children}
    </button>
  );
}

export function LinkButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer">
      {children}
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Executa uma ação assíncrona controlando "carregando" e a mensagem de erro. */
export function useAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err: any) {
      setError(err?.message ?? 'Erro inesperado');
      return undefined;
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, setError, run };
}
