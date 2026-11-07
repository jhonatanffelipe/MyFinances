import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { appSession } from '../../engine/session';
import { qrFlow } from '../../engine/qrFlow';
import { COLORS } from '../../theme/tokens';

/** Lê o QR do computador e conecta ao projeto dele. */
export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const onScan = async (text: string) => {
    if (handled.current) return;
    handled.current = true;
    setBusy(true);
    setError(null);
    try {
      const preview = await appSession.readConnectionQr(text);
      qrFlow.set(text, preview);
      router.replace('/connect/who');
    } catch (err: any) {
      setError(err?.message ?? 'QR inválido');
      handled.current = false;
    } finally {
      setBusy(false);
    }
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator color={COLORS.brand} /></View>;
  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: 24, gap: 16, backgroundColor: COLORS.canvas }]}>
        <Text style={{ textAlign: 'center', color: COLORS.ink }}>Para ler o QR do computador, o MyFinances precisa usar a câmera.</Text>
        <Button mode="contained" onPress={requestPermission}>
          Permitir câmera
        </Button>
        <Button onPress={() => router.replace('/connect/code')}>Prefiro colar o código</Button>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy ? undefined : ({ data }) => onScan(data)}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={styles.footer}>
        {busy ? <ActivityIndicator color="#fff" /> : null}
        <Text style={styles.hint}>{error ?? 'Aponte para o QR em Perfil → Conectar celular, no computador.'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { position: 'absolute', alignSelf: 'center', top: '28%', width: 250, height: 250, borderWidth: 3, borderColor: '#fff', borderRadius: 24 },
  footer: { position: 'absolute', bottom: 60, left: 24, right: 24, alignItems: 'center', gap: 12 },
  hint: { color: '#fff', textAlign: 'center', fontWeight: '600', textShadowColor: '#000', textShadowRadius: 6 },
});
