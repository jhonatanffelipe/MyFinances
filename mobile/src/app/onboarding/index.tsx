import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ResponseType, useAuthRequest } from 'expo-auth-session';
import { Button, HelperText, Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MicrosoftLoginModal, parseRedirectParams } from '../../components/MicrosoftLoginModal';
import { MICROSOFT_CLIENT_ID, MICROSOFT_DISCOVERY, MICROSOFT_REDIRECT_URI, MICROSOFT_SCOPES } from '../../sync/config';
import { completeSignIn } from '../../sync/msAuth';
import { onSignedIn } from '../../sync/syncManager';
import { useSync } from '../../contexts/SyncContext';
import { COLORS } from '../../theme/tokens';

/** Boas-vindas + login na conta Microsoft (OneDrive). */
export default function Onboarding() {
  const { sync } = useSync();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Só monta a URL de autorização (PKCE + state); quem abre é a WebView do MicrosoftLoginModal
  const [request] = useAuthRequest(
    {
      clientId: MICROSOFT_CLIENT_ID,
      scopes: MICROSOFT_SCOPES,
      redirectUri: MICROSOFT_REDIRECT_URI,
      responseType: ResponseType.Code,
      usePKCE: true,
      extraParams: { prompt: 'select_account' },
    },
    MICROSOFT_DISCOVERY
  );

  const handleRedirect = (url: string) => {
    setLoginOpen(false);
    const params = parseRedirectParams(url);

    if (params.error) {
      setError(params.error_description || params.error || 'Login cancelado ou recusado');
      return;
    }
    if (!params.code || !request?.codeVerifier || params.state !== request.state) {
      setError('Resposta de login inválida. Tente novamente.');
      return;
    }

    setBusy(true);
    completeSignIn(params.code, request.codeVerifier, MICROSOFT_REDIRECT_URI)
      .then(onSignedIn)
      .then(() => router.replace('/onboarding/pick'))
      .catch((err) => setError(err?.message || 'Falha ao concluir o login'))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    if (sync.signedIn && !sync.remote) router.replace('/onboarding/pick');
  }, [sync.signedIn, sync.remote]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Icon source="wallet" size={40} color="#fff" />
        </View>
        <Text variant="headlineMedium" style={styles.title}>
          MyFinances
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Use o mesmo banco do computador. O arquivo fica no seu OneDrive e as alterações feitas aqui aparecem lá, e
          vice-versa.
        </Text>
      </View>

      <View style={styles.steps}>
        {[
          ['microsoft', 'Entre com a conta Microsoft do seu OneDrive'],
          ['folder-search-outline', 'Escolha o arquivo db_myfinances.sqlite'],
          ['account-lock-outline', 'Entre com o mesmo usuário e senha do desktop'],
        ].map(([icon, text], i) => (
          <View key={icon} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Icon source={icon} size={20} color={COLORS.inkMuted} />
            <Text style={styles.stepText}>{text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        {!MICROSOFT_CLIENT_ID ? (
          <HelperText type="error" visible>
            Configure o Client ID do Microsoft Entra em app.json (expo.extra.microsoftClientId). Veja o README.
          </HelperText>
        ) : null}
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
        <Button
          mode="contained"
          icon="microsoft"
          contentStyle={{ paddingVertical: 6 }}
          disabled={!request || !MICROSOFT_CLIENT_ID || busy}
          loading={busy}
          onPress={() => {
            setError(null);
            setLoginOpen(true);
          }}
        >
          Entrar com Microsoft
        </Button>
      </View>

      <MicrosoftLoginModal
        visible={loginOpen}
        authUrl={request?.url ?? null}
        redirectUri={MICROSOFT_REDIRECT_URI}
        onRedirect={handleRedirect}
        onClose={() => setLoginOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas, padding: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 12, marginTop: 32 },
  logo: { width: 76, height: 76, borderRadius: 22, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', color: COLORS.ink },
  subtitle: { textAlign: 'center', color: COLORS.inkMuted, lineHeight: 20 },
  steps: { gap: 14, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 12, fontWeight: '800', color: COLORS.brandDark },
  stepText: { flex: 1, color: COLORS.ink },
  footer: { gap: 8 },
});
