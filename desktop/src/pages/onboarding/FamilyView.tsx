import React, { useState } from 'react';
import { Home, LogOut, Ticket, Users } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { ErrorBox, Field, LinkButton, PrimaryButton, Shell, Tabs, useAction } from '../../components/ui';

/** Depois do login, sem família: criar a própria ou entrar com convite. */
export function FamilyView() {
  const { state, apply } = useAppState();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(state.user ? `Família ${state.user.name.split(' ').slice(-1)[0]}` : '');
  const [code, setCode] = useState('');
  const action = useAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    action.run(async () => {
      apply(tab === 'create' ? await window.appAPI.createFamily(name) : await window.appAPI.joinFamily(code));
    });
  };

  return (
    <Shell
      icon={Users}
      title={`Olá, ${state.user?.name ?? ''}!`}
      subtitle="Os lançamentos ficam dentro de uma família. Crie a sua ou entre na de alguém com o código de convite."
    >
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          action.setError(null);
        }}
        options={[
          { value: 'create', label: 'Criar família' },
          { value: 'join', label: 'Tenho convite' },
        ]}
      />
      {!state.online && <ErrorBox message="Sem internet: criar família e aceitar convite precisam de conexão." />}
      <ErrorBox message={action.error} />
      <form onSubmit={submit} className="space-y-4">
        {tab === 'create' ? (
          <Field
            label="Nome da família"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            hint="Já vem com as categorias padrão. Depois você pode importar seu banco da v1."
          />
        ) : (
          <Field label="Código de convite" placeholder="mf1.eyJ2Ijox..." value={code} onChange={(e) => setCode(e.target.value)} textarea required />
        )}
        <PrimaryButton type="submit" loading={action.loading} disabled={!state.online}>
          {tab === 'create' ? (
            <>
              <Home className="w-4 h-4" /> Criar família
            </>
          ) : (
            <>
              <Ticket className="w-4 h-4" /> Entrar na família
            </>
          )}
        </PrimaryButton>
      </form>
      <div className="text-center mt-5">
        <LinkButton onClick={() => action.run(async () => apply(await window.appAPI.signOut(true)))}>
          <span className="inline-flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </span>
        </LinkButton>
      </div>
    </Shell>
  );
}
