import React from 'react';
import { router } from 'expo-router';
import { Button } from 'react-native-paper';
import { ErrorText, InfoBox, OnboardingShell, useAction } from '../../components/Onboarding';
import { useAppState } from '../../contexts/AppStateContext';
import { appSession } from '../../engine/session';
import { qrFlow } from '../../engine/qrFlow';

/** "Quem vai usar este celular?": Sou eu (pareamento) ou Sou outra pessoa (convite). */
export default function Who() {
  const { apply } = useAppState();
  const flow = qrFlow.get();
  const action = useAction();

  if (!flow) {
    return (
      <OnboardingShell icon="qrcode-remove" title="Leia o QR de novo">
        <Button mode="contained" onPress={() => router.replace('/connect/scan')}>
          Ler QR Code
        </Button>
      </OnboardingShell>
    );
  }
  const { preview, text } = flow;
  const by = preview.byName ?? 'quem gerou o QR';

  const itsMe = () =>
    action.run(async () => {
      const result = await appSession.startPairing(text);
      // Sem a Edge Function: o AppSession já foi para o login com o e-mail preenchido
      if (result.mode === 'pair') router.replace('/connect/waiting');
    });

  const someoneElse = () =>
    action.run(async () => {
      qrFlow.clear();
      apply(await appSession.useConnectionCode(text)); // vai para o cadastro com o convite
    });

  return (
    <OnboardingShell
      icon="account-question-outline"
      title="Quem vai usar este celular?"
      subtitle={`${preview.familyName ? `Família ${preview.familyName.replace(/^Família\s+/i, '')}` : 'Família'} · conectado por ${by}`}
    >
      <Button mode="contained" icon="account-check-outline" contentStyle={{ paddingVertical: 6 }} loading={action.loading} disabled={action.loading} onPress={itsMe}>
        Sou eu ({by})
      </Button>
      {preview.canInvite ? (
        <Button mode="outlined" icon="account-plus-outline" disabled={action.loading} onPress={someoneElse}>
          Sou outra pessoa da família
        </Button>
      ) : (
        <InfoBox text="Só quem administra a família gera QR para outra pessoa entrar. Peça a ele um convite." />
      )}
      {!preview.canPair ? <InfoBox icon="key-outline" text={`"Sou eu" vai pedir a sua senha uma vez (a conexão sem senha não está configurada neste banco).`} /> : null}
      <ErrorText message={action.error} />
    </OnboardingShell>
  );
}
