import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, SegmentedButtons, TextInput } from 'react-native-paper';
import { ErrorText, InfoBox, OnboardingShell, useAction } from '../components/Onboarding';
import { useAppState } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';

/**
 * Sem família (depois do login): criar a própria ou entrar com convite. Com `?add=1`,
 * cria/entra em OUTRA família a partir do seletor.
 */
export default function Family() {
  const { state, apply, requestSignOut } = useAppState();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const adding = add === '1';
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(state.user ? `Família ${state.user.name.split(' ').slice(-1)[0]}` : '');
  const [code, setCode] = useState('');
  const action = useAction();

  const submit = () =>
    action.run(async () => {
      apply(mode === 'create' ? await appSession.createFamily(name) : await appSession.joinFamily(code));
      if (adding) router.back();
    });

  return (
    <OnboardingShell
      icon="home-group"
      title={adding ? 'Outra família' : `Olá, ${state.user?.name ?? ''}!`}
      subtitle="Os lançamentos ficam dentro de uma família. Crie a sua ou entre na de alguém com o código de convite."
    >
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => {
          setMode(v as 'create' | 'join');
          action.setError(null);
        }}
        buttons={[
          { value: 'create', label: 'Criar família' },
          { value: 'join', label: 'Tenho convite' },
        ]}
      />
      {!state.online ? <InfoBox tone="warn" icon="wifi-off" text="Sem internet: criar família e aceitar convite precisam de conexão." /> : null}
      {mode === 'create' ? (
        <TextInput mode="outlined" label="Nome da família" value={name} onChangeText={setName} />
      ) : (
        <TextInput mode="outlined" label="Código de convite" placeholder="mf1.eyJ2Ijox..." value={code} onChangeText={setCode} multiline autoCapitalize="none" style={{ minHeight: 100 }} />
      )}
      {mode === 'create' ? <InfoBox text="A família já vem com as categorias padrão." /> : null}
      <ErrorText message={action.error} />
      <Button mode="contained" loading={action.loading} disabled={action.loading || !state.online} onPress={submit} contentStyle={{ paddingVertical: 6 }}>
        {mode === 'create' ? 'Criar família' : 'Entrar na família'}
      </Button>
      {adding ? (
        <Button onPress={() => router.back()}>Cancelar</Button>
      ) : (
        <Button icon="logout" onPress={() => requestSignOut()}>
          Sair
        </Button>
      )}
    </OnboardingShell>
  );
}
