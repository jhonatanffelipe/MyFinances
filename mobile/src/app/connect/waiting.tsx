import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { InfoBox, OnboardingShell } from '../../components/Onboarding';
import { useAppState } from '../../contexts/AppStateContext';
import { appSession, deviceName } from '../../engine/session';
import { qrFlow } from '../../engine/qrFlow';
import { COLORS } from '../../theme/tokens';

/** Espera o "Permitir" no computador e entra com uma sessão própria deste celular. */
export default function Waiting() {
  const { apply } = useAppState();
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    appSession
      .completePairing({ isCancelled: () => cancelled.current })
      .then((state) => {
        qrFlow.clear();
        apply(state);
      })
      .catch((err) => {
        if (!cancelled.current) setError({ code: err?.code, message: err?.message ?? 'Não foi possível conectar' });
      });
    return () => {
      cancelled.current = true;
    };
  }, [apply]);

  const again = () => {
    cancelled.current = true;
    qrFlow.clear();
    router.replace('/connect/scan');
  };

  if (error) {
    const title =
      error.code === 'PAIRING_DENIED' ? 'Conexão recusada' : error.code === 'PAIRING_USED' ? 'QR já usado' : error.code === 'PAIRING_EXPIRED' ? 'QR expirado' : 'Não deu certo';
    return (
      <OnboardingShell icon="cellphone-remove" title={title} subtitle={error.message}>
        <Button mode="contained" icon="qrcode-scan" onPress={again}>
          Ler outro QR
        </Button>
        <Button onPress={() => router.replace('/connect')}>Voltar</Button>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell icon="monitor-cellphone" title="Confirme no computador" subtitle={`Toque em "Permitir" no aviso que apareceu no computador para conectar ${deviceName()}.`}>
      <ActivityIndicator color={COLORS.brand} size="large" style={{ marginVertical: 16 }} />
      <InfoBox text="O pedido vale por 2 minutos. Mantenha esta tela aberta." />
      <Text style={{ textAlign: 'center' }}>
        <Text onPress={again} style={{ color: COLORS.brandDark, fontWeight: '700' }}>
          Cancelar
        </Text>
      </Text>
    </OnboardingShell>
  );
}
