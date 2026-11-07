import React, { useState } from 'react';
import { Linking } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { ErrorText, InfoBox, OnboardingShell, useAction } from '../../components/Onboarding';
import { useAppState } from '../../contexts/AppStateContext';
import { appSession } from '../../engine/session';

/** Project URL + publishable key do Supabase (alternativa ao QR). */
export default function Manual() {
  const { apply } = useAppState();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [ok, setOk] = useState<string | null>(null);
  const action = useAction();

  return (
    <OnboardingShell icon="database-cog-outline" title="Conectar ao seu banco" subtitle="Em Project Settings → API do seu projeto Supabase, copie a Project URL e a Publishable key.">
      <TextInput mode="outlined" label="Project URL" placeholder="https://abcdefgh.supabase.co" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      <TextInput mode="outlined" label="Publishable key" placeholder="sb_publishable_..." value={key} onChangeText={setKey} autoCapitalize="none" />
      <InfoBox text="Essa chave é pública por design: quem protege os dados é o login e as regras do banco. Nunca use a chave secreta." />
      {ok ? <InfoBox tone="success" icon="check-circle-outline" text={ok} /> : null}
      <ErrorText message={action.error} />
      <Button
        mode="outlined"
        disabled={action.loading || !url || !key}
        onPress={() =>
          action.run(async () => {
            setOk(null);
            const r = await appSession.checkConnection(url, key);
            setOk(`Conexão ok: banco preparado (versão ${r.schemaVersion}).`);
          })
        }
      >
        Testar conexão
      </Button>
      <Button mode="contained" loading={action.loading} disabled={action.loading || !url || !key} onPress={() => action.run(async () => apply(await appSession.saveConnection(url, key)))}>
        Conectar
      </Button>
      <Button icon="open-in-new" onPress={() => Linking.openURL('https://supabase.com/dashboard')}>
        Abrir o painel do Supabase
      </Button>
    </OnboardingShell>
  );
}
