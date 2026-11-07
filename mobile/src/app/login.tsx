import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { ErrorText, InfoBox, OnboardingShell, useAction } from '../components/Onboarding';
import { useAppState } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';
import { COLORS } from '../theme/tokens';

type Mode = 'login' | 'signup' | 'reset';

/** Login, cadastro e "esqueci a senha" no Supabase Auth do banco conectado. */
export default function Login() {
  const { state, apply } = useAppState();
  const [mode, setMode] = useState<Mode>(state.pendingInvite ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(state.loginHint?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const action = useAction();

  useEffect(() => {
    if (state.loginHint?.email) setEmail(state.loginHint.email);
  }, [state.loginHint?.email]);

  const submit = () =>
    action.run(async () => {
      setInfo(null);
      if (mode === 'login') apply(await appSession.signIn(email, password));
      else if (mode === 'signup') apply(await appSession.signUp(name, email, password));
      else {
        await appSession.requestPasswordReset(email);
        setInfo('Se existir uma conta com esse e-mail, enviamos o link para criar uma senha nova.');
      }
    });

  return (
    <OnboardingShell
      icon={mode === 'signup' ? 'account-plus-outline' : 'login'}
      title={mode === 'signup' ? 'Criar sua conta' : mode === 'reset' ? 'Esqueci a senha' : 'Entrar no MyFinances'}
      subtitle={mode === 'signup' ? 'Sua conta fica no banco conectado e serve para todos os seus aparelhos.' : 'Use o e-mail e a senha da sua conta.'}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, color: COLORS.inkMuted, fontSize: 12 }} numberOfLines={1}>
          Banco: {state.connection?.url}
        </Text>
        <Button compact onPress={() => action.run(async () => apply(await appSession.forgetConnection()))}>
          Trocar
        </Button>
      </View>

      {state.pendingInvite ? (
        <InfoBox
          tone="success"
          icon="ticket-outline"
          text={`Convite de ${state.pendingInvite.by ?? 'um membro'} para a família ${state.pendingInvite.familyName ?? ''}. Entre ou crie sua conta para aceitar.`}
        />
      ) : null}
      {state.loginHint ? <InfoBox icon="key-outline" text="Digite a sua senha uma vez para conectar este celular." /> : null}

      {mode !== 'reset' ? (
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode);
            action.setError(null);
          }}
          buttons={[
            { value: 'login', label: 'Entrar' },
            { value: 'signup', label: 'Criar conta' },
          ]}
        />
      ) : null}

      {mode === 'signup' ? <TextInput mode="outlined" label="Seu nome" value={name} onChangeText={setName} placeholder="Como a família te chama" /> : null}
      <TextInput mode="outlined" label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      {mode !== 'reset' ? (
        <TextInput
          mode="outlined"
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} />}
        />
      ) : null}
      {info ? <InfoBox tone="success" icon="email-check-outline" text={info} /> : null}
      <ErrorText message={action.error} />

      <Button mode="contained" loading={action.loading} disabled={action.loading} onPress={submit} contentStyle={{ paddingVertical: 6 }}>
        {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
      </Button>
      {mode === 'login' ? <Button onPress={() => setMode('reset')}>Esqueci a senha</Button> : null}
      {mode === 'reset' ? <Button onPress={() => setMode('login')}>Voltar para o login</Button> : null}
    </OnboardingShell>
  );
}
