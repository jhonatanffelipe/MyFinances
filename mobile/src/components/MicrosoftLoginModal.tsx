import React, { useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { ActivityIndicator, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { COLORS } from '../theme/tokens';

interface Props {
  visible: boolean;
  /** URL de autorização já montada (PKCE + state). */
  authUrl: string | null;
  /** Ao navegar para esta URI, o login terminou: a URL recebida traz code/error. */
  redirectUri: string;
  onRedirect: (url: string) => void;
  onClose: () => void;
}

/**
 * Login Microsoft dentro de uma WebView do próprio app.
 * O retorno é interceptado na navegação, sem depender do navegador devolver
 * um esquema (exp:// ou myfinances://) ao app — o que falha no Android/Expo Go.
 */
export function MicrosoftLoginModal({ visible, authUrl, redirectUri, onRedirect, onClose }: Props) {
  const handled = useRef(false);

  const intercept = (url: string) => {
    if (!url.startsWith(redirectUri)) return false;
    if (!handled.current) {
      handled.current = true;
      onRedirect(url);
    }
    return true;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        handled.current = false;
      }}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            Entrar com Microsoft
          </Text>
          <IconButton icon="close" onPress={onClose} accessibilityLabel="Fechar" />
        </View>
        {authUrl ? (
          <WebView
            source={{ uri: authUrl }}
            incognito
            startInLoadingState
            renderLoading={() => <ActivityIndicator style={styles.loading} color={COLORS.brand} />}
            onShouldStartLoadWithRequest={(req) => !intercept(req.url)}
            onNavigationStateChange={(nav) => intercept(nav.url)}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

/** Lê os parâmetros da URL de retorno (query ou fragmento). */
export function parseRedirectParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const raw = url.split(/[?#]/).slice(1).join('&');
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const [key, value = ''] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return params;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  title: { fontWeight: '700', color: COLORS.ink },
  loading: { position: 'absolute', top: '50%', alignSelf: 'center' },
});
