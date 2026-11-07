import React, { useState } from 'react';
import { ClipboardCopy, Database, ExternalLink, KeyRound, Ticket } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Shell, SuccessBox, Tabs, useAction } from '../../components/ui';

/**
 * Primeira tela: conectar ao Supabase da pessoa. Substitui a escolha de pasta da v1.
 * "Criar meu banco" (dono) ou "Tenho um código de convite" (membro).
 */
export function ConnectView() {
  const { apply } = useAppState();
  const [tab, setTab] = useState<'own' | 'invite'>('own');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<string | null>(null);
  const action = useAction();

  const copySetupSql = async () => {
    const sql = await window.appAPI.getSetupSql();
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const test = () =>
    action.run(async () => {
      setChecked(null);
      const r = await window.appAPI.checkConnection(url, key);
      setChecked(`Conexão ok: banco preparado (versão ${r.schemaVersion}).`);
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    action.run(async () => apply(await window.appAPI.saveConnection(url, key)));
  };

  const useCode = (e: React.FormEvent) => {
    e.preventDefault();
    action.run(async () => apply(await window.appAPI.useConnectionCode(code)));
  };

  return (
    <Shell
      icon={Database}
      title="Conectar ao seu banco"
      subtitle="Na v2 os dados ficam no seu próprio projeto Supabase e numa cópia neste computador, que funciona sem internet."
      wide
    >
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          action.setError(null);
        }}
        options={[
          { value: 'own', label: 'Criar meu banco' },
          { value: 'invite', label: 'Tenho um código de convite' },
        ]}
      />

      <ErrorBox message={action.error} />
      <SuccessBox message={checked} />

      {tab === 'own' ? (
        <form onSubmit={save} className="space-y-4">
          <ol className="text-xs text-slate-600 space-y-2 bg-slate-50 border border-slate-100 rounded-2xl p-4 list-decimal list-inside leading-relaxed">
            <li>
              Crie uma conta grátis e um projeto novo em{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 inline-flex items-center gap-0.5">
                supabase.com <ExternalLink className="w-3 h-3" />
              </a>
              .
            </li>
            <li>
              Copie o script de instalação, abra <strong>SQL Editor</strong> no projeto, cole e clique em <strong>Run</strong>.
              <button type="button" onClick={copySetupSql} className="ml-2 inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline cursor-pointer">
                <ClipboardCopy className="w-3.5 h-3.5" />
                {copied ? 'Copiado!' : 'Copiar script'}
              </button>
            </li>
            <li>
              Em <strong>Project Settings → API</strong>, copie a <em>Project URL</em> e a <em>Publishable key</em>. Nunca use a chave
              secreta.
            </li>
          </ol>
          <Field label="Project URL" placeholder="https://abcdefgh.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} required />
          <Field
            label="Publishable key"
            placeholder="sb_publishable_..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
            hint="Essa chave é pública por design: quem protege os dados é o login e as regras do banco."
          />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <SecondaryButton onClick={test} disabled={action.loading || !url || !key}>
              <KeyRound className="w-4 h-4" /> Testar conexão
            </SecondaryButton>
            <PrimaryButton type="submit" loading={action.loading}>
              Conectar
            </PrimaryButton>
          </div>
        </form>
      ) : (
        <form onSubmit={useCode} className="space-y-4">
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl p-4 leading-relaxed">
            Quem administra a família gera o código em <strong>Membros → Convidar</strong> e manda para você (WhatsApp, e-mail...). Ele
            já contém o endereço do banco e o convite.
          </p>
          <Field label="Código de convite" placeholder="mf1.eyJ2Ijox..." value={code} onChange={(e) => setCode(e.target.value)} textarea required />
          <PrimaryButton type="submit" loading={action.loading}>
            <Ticket className="w-4 h-4" /> Usar código
          </PrimaryButton>
        </form>
      )}
    </Shell>
  );
}
