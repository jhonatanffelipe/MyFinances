import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, Text } from 'react-native-paper';
import { useAppState } from '../contexts/AppStateContext';
import { COLORS } from '../theme/tokens';

/** Status do SyncEngine: offline / N pendentes / recusadas / erro. Toque abre os detalhes. */
export function SyncBanner() {
  const { sync, state } = useAppState();
  if (state.phase !== 'ready') return null;
  const offline = !state.online || sync.phase === 'offline';
  let item: { icon: string; color: string; bg: string; text: string } | null = null;

  if (sync.failed > 0) {
    item = { icon: 'alert-outline', color: '#92400e', bg: COLORS.amberSoft, text: `${sync.failed} alteração(ões) recusada(s) pelo servidor. Toque para resolver.` };
  } else if (offline) {
    item = {
      icon: 'cloud-off-outline',
      color: COLORS.inkMuted,
      bg: '#e2e8f0',
      text: sync.pending > 0 ? `Sem internet · ${sync.pending} alteração(ões) aguardando envio. Ficam salvas no celular.` : 'Sem internet. Tudo continua funcionando neste celular.',
    };
  } else if (sync.phase === 'error' && sync.lastError) {
    item = { icon: 'alert-circle-outline', color: '#991b1b', bg: COLORS.dangerSoft, text: `Erro ao sincronizar: ${sync.lastError}` };
  }
  if (!item) return null;

  return (
    <Pressable onPress={() => router.push('/sync')} style={[styles.banner, { backgroundColor: item.bg }]}>
      <Icon source={item.icon} size={18} color={item.color} />
      <Text variant="bodySmall" style={[styles.text, { color: item.color }]}>
        {item.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, alignItems: 'flex-start' },
  text: { flex: 1 },
});

