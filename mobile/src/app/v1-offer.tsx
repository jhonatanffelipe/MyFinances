import React from 'react';
import { router } from 'expo-router';
import { Button } from 'react-native-paper';
import { InfoBox, OnboardingShell, useAction } from '../components/Onboarding';
import { useAppState } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';

/** Logo depois de criar a família: importar o banco da v1 ou começar do zero. */
export default function V1Offer() {
  const { apply } = useAppState();
  const action = useAction();
  return (
    <OnboardingShell icon="history" title="Você já usa o MyFinances v1?" subtitle="Traga seus lançamentos, fixos, categorias e cartões para a família. Dá para fazer depois pelo Perfil.">
      <Button mode="contained" icon="database-import-outline" contentStyle={{ paddingVertical: 6 }} onPress={() => router.push('/import-v1')}>
        Importar meu banco da v1
      </Button>
      <Button mode="outlined" loading={action.loading} onPress={() => action.run(async () => apply(await appSession.dismissV1Offer()))}>
        Começar do zero
      </Button>
      <InfoBox text="Copie o db_myfinances.sqlite da v1 para o celular (ou deixe-o num app de arquivos ou de nuvem do celular) e escolha o arquivo na próxima tela." />
    </OnboardingShell>
  );
}
