import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SyncProvider } from '../contexts/SyncContext';
import { SessionProvider } from '../contexts/SessionContext';
import { paperTheme } from '../theme/paperTheme';
import { COLORS } from '../theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme} settings={{ icon: (props) => <MaterialCommunityIcons {...(props as any)} /> }}>
        <SyncProvider>
          <SessionProvider>
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
              <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/pick" options={{ title: 'Escolha o banco no OneDrive' }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="movement/[id]" options={{ title: 'Movimentação', presentation: 'modal' }} />
              <Stack.Screen name="fixed/[id]" options={{ title: 'Lançamento fixo', presentation: 'modal' }} />
              <Stack.Screen name="categories/index" options={{ title: 'Categorias' }} />
              <Stack.Screen name="categories/[id]" options={{ title: 'Categoria', presentation: 'modal' }} />
              <Stack.Screen name="cards/index" options={{ title: 'Cartões de crédito' }} />
              <Stack.Screen name="cards/[id]" options={{ title: 'Cartão', presentation: 'modal' }} />
              <Stack.Screen name="bulk-delete" options={{ title: 'Excluir por cartão', presentation: 'modal' }} />
              <Stack.Screen name="import" options={{ title: 'Importar fatura' }} />
              <Stack.Screen name="sync" options={{ title: 'Sincronização' }} />
            </Stack>
          </SessionProvider>
        </SyncProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
