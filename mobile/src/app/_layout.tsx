import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AppStateProvider, useAppState } from '../contexts/AppStateContext';
import { paperTheme } from '../theme/paperTheme';
import { COLORS } from '../theme/tokens';

/** Quando a fase muda (login, saiu, sem família...), volta ao portão, que decide a tela. */
function PhaseRouter() {
  const { state } = useAppState();
  const previous = useRef(state.phase);
  useEffect(() => {
    if (state.phase === previous.current) return;
    previous.current = state.phase;
    if (state.phase !== 'loading') router.replace('/');
  }, [state.phase]);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme} settings={{ icon: (props) => <MaterialCommunityIcons {...(props as any)} /> }}>
        <AppStateProvider>
          <PhaseRouter />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: COLORS.surface },
              headerTintColor: COLORS.ink,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: COLORS.canvas },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="connect/index" options={{ headerShown: false }} />
            <Stack.Screen name="connect/scan" options={{ title: 'Ler QR Code', headerTransparent: true, headerTintColor: '#fff' }} />
            <Stack.Screen name="connect/who" options={{ title: 'Quem vai usar?' }} />
            <Stack.Screen name="connect/waiting" options={{ title: 'Confirme no computador', headerBackVisible: false, gestureEnabled: false }} />
            <Stack.Screen name="connect/manual" options={{ title: 'Conectar manualmente' }} />
            <Stack.Screen name="connect/code" options={{ title: 'Código de convite' }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="family" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="movement/[id]" options={{ title: 'Movimentação', presentation: 'modal' }} />
            <Stack.Screen name="fixed/[id]" options={{ title: 'Lançamento fixo', presentation: 'modal' }} />
            <Stack.Screen name="categories/index" options={{ title: 'Categorias' }} />
            <Stack.Screen name="categories/[id]" options={{ title: 'Categoria', presentation: 'modal' }} />
            <Stack.Screen name="cards/index" options={{ title: 'Cartões de crédito' }} />
            <Stack.Screen name="cards/[id]" options={{ title: 'Cartão', presentation: 'modal' }} />
            <Stack.Screen name="bulk-delete" options={{ title: 'Excluir por cartão', presentation: 'modal' }} />
            <Stack.Screen name="import" options={{ title: 'Importar fatura' }} />
            <Stack.Screen name="members" options={{ title: 'Membros' }} />
            <Stack.Screen name="profile" options={{ title: 'Meu perfil' }} />
            <Stack.Screen name="sync" options={{ title: 'Sincronização' }} />
            <Stack.Screen name="v1-offer" options={{ headerShown: false }} />
            <Stack.Screen name="import-v1" options={{ title: 'Importar banco da v1' }} />
          </Stack>
        </AppStateProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
