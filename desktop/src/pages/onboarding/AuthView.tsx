import React, { useState } from 'react';
import { Database, LogIn, Ticket, UserPlus } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { ErrorBox, Field, LinkButton, PrimaryButton, Shell, SuccessBox, Tabs, useAction } from '../../components/ui';

/** Login, cadastro e "esqueci a senha" no Supabase Auth do banco conectado. */
export function AuthView() {
  const { state, apply } = useAppState();
  const [tab, setTab] = useState<'login' | 'signup' | 'reset'>(state.pendingInvite ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const action = useAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setInfo(null);
    action.run(async () => {
      if (tab === 'login') apply(await window.appAPI.signIn(email, password));
      else if (tab === 'signup') apply(await window.appAPI.signUp(name, email, password));
      else {
        await window.appAPI.requestPasswordReset(email);
        setInfo('Se existir uma conta com esse e-mail, enviamos o link para criar uma senha nova.');
      }
    });
  };

  const forget = () => action.run(async () => apply(await window.appAPI.forgetConnection()));

  return (
    <Shell
      title={tab === 'signup' ? 'Criar sua conta' : tab === 'reset' ? 'Esqueci a senha' : 'Entrar no MyFinances'}
      subtitle={tab === 'signup' ? 'Sua conta fica no banco conectado e serve para todos os seus aparelhos.' : 'Use o e-mail e a senha da sua conta.'}
    >
      <div className="w-full bg-slate-50/80 border border-slate-100 rounded-2xl p-3.5 flex items-center gap-3.5 mb-5">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider block">Banco conectado</span>
          <span className="text-xs text-slate-500 font-mono truncate block">{state.connection?.url}</span>
        </div>
        <LinkButton onClick={forget}>Trocar</LinkButton>
      </div>

      {state.pendingInvite && (
        <div className="w-full mb-5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2">
          <Ticket className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Convite de <strong>{state.pendingInvite.by ?? 'um membro'}</strong> para a família{' '}
            <strong>{state.pendingInvite.familyName ?? ''}</strong>. Entre ou crie sua conta para aceitar.
          </span>
        </div>
      )}

      {tab !== 'reset' && (
        <Tabs
          value={tab}
          onChange={(v) => {
            setTab(v);
            action.setError(null);
          }}
          options={[
            { value: 'login', label: 'Entrar' },
            { value: 'signup', label: 'Criar conta' },
          ]}
        />
      )}

      <ErrorBox message={action.error} />
      <SuccessBox message={info} />

      <form onSubmit={submit} className="space-y-4">
        {tab === 'signup' && <Field label="Seu nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como a família te chama" required />}
        <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        {tab !== 'reset' && (
          <Field
            label="Senha"
            password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            hint={tab === 'signup' ? 'Mínimo de 6 caracteres.' : undefined}
          />
        )}
        <PrimaryButton type="submit" loading={action.loading}>
          {tab === 'login' && (
            <>
              <LogIn className="w-4 h-4" /> Entrar
            </>
          )}
          {tab === 'signup' && (
            <>
              <UserPlus className="w-4 h-4" /> Criar conta
            </>
          )}
          {tab === 'reset' && 'Enviar link'}
        </PrimaryButton>
      </form>

      <div className="text-center mt-5">
        {tab === 'reset' ? (
          <LinkButton onClick={() => setTab('login')}>Voltar para o login</LinkButton>
        ) : (
          tab === 'login' && <LinkButton onClick={() => setTab('reset')}>Esqueci a senha</LinkButton>
        )}
      </div>
    </Shell>
  );
}
