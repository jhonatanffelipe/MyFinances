import React from 'react';
import { router } from 'expo-router';
import { Button, Text } from 'react-native-paper';
import { InfoBox, OnboardingShell } from '../../components/Onboarding';
import { COLORS } from '../../theme/tokens';

/** Primeira tela: Ler QR Code do computador (principal), manual ou código de convite. */
export default function Connect() {
  return (
    <OnboardingShell
      icon="qrcode-scan"
      title="Conectar o MyFinances"
      subtitle="No computador, abra Perfil → Conectar celular e aponte a câmera para o QR. Em segundos o celular fica conectado e sincronizando."
    >
      <Button mode="contained" icon="qrcode-scan" contentStyle={{ paddingVertical: 8 }} onPress={() => router.push('/connect/scan')}>
        Ler QR Code
      </Button>
      <Button mode="outlined" icon="ticket-outline" onPress={() => router.push('/connect/code')}>
        Tenho um código de convite
      </Button>
      <Button mode="text" icon="database-cog-outline" onPress={() => router.push('/connect/manual')}>
        Conectar manualmente
      </Button>
      <InfoBox text="Os dados ficam no seu próprio projeto Supabase e numa cópia neste celular, que funciona sem internet." />
      <Text style={{ color: COLORS.inkFaint, fontSize: 11, textAlign: 'center' }}>
        Ainda não tem banco? Crie pelo MyFinances no computador.
      </Text>
    </OnboardingShell>
  );
}
