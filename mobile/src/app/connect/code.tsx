import React, { useState } from 'react';
import { Button, TextInput } from 'react-native-paper';
import { ErrorText, InfoBox, OnboardingShell, useAction } from '../../components/Onboarding';
import { useAppState } from '../../contexts/AppStateContext';
import { appSession } from '../../engine/session';

/** Código de convite (mf1...) colado: conecta ao banco da família e vai para o cadastro. */
export default function Code() {
  const { apply } = useAppState();
  const [code, setCode] = useState('');
  const action = useAction();
  return (
    <OnboardingShell icon="ticket-outline" title="Código de convite" subtitle="Quem administra a família gera o código em Membros → Convidar e manda para você.">
      <TextInput mode="outlined" label="Código" placeholder="mf1.eyJ2Ijox..." value={code} onChangeText={setCode} multiline numberOfLines={4} autoCapitalize="none" style={{ minHeight: 110 }} />
      <InfoBox text="O código já traz o endereço do banco e o convite para a família." />
      <ErrorText message={action.error} />
      <Button mode="contained" icon="ticket-confirmation-outline" loading={action.loading} disabled={action.loading || !code.trim()} onPress={() => action.run(async () => apply(await appSession.useConnectionCode(code)))}>
        Usar código
      </Button>
    </OnboardingShell>
  );
}
