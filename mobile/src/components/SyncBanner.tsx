import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useSync } from '../contexts/SyncContext';
import { COLORS } from '../theme/tokens';

/** Avisos de sincronização: outro dispositivo com o banco aberto, sem internet ou erro. */
export function SyncBanner() {
  const { sync } = useSync();
  const items: { icon: string; color: string; bg: string; text: string }[] = [];

  if (sync.otherDevice) {
    items.push({
      icon: 'monitor-cellphone',
      color: '#92400e',
      bg: COLORS.amberSoft,
      text: `Banco também aberto em ${sync.otherDevice.deviceName}${sync.otherDevice.app === 'desktop' ? ' (computador)' : ''}. Evite editar nos dois ao mesmo tempo.`,
    });
  }
  if (sync.status === 'offline' || (sync.pendingUpload && sync.status !== 'syncing' && sync.status !== 'pending')) {
    items.push({
      icon: 'cloud-off-outline',
      color: COLORS.inkMuted,
      bg: '#e2e8f0',
      text: 'Sem conexão com o OneDrive. Suas alterações ficam salvas no celular e serão enviadas depois.',
    });
  } else if (sync.status === 'error' && sync.error) {
    items.push({ icon: 'alert-circle-outline', color: '#991b1b', bg: COLORS.dangerSoft, text: sync.error });
  }

  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.text} style={[styles.banner, { backgroundColor: item.bg }]}>
          <Icon source={item.icon} size={18} color={item.color} />
          <Text variant="bodySmall" style={[styles.text, { color: item.color }]}>
            {item.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  banner: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, alignItems: 'flex-start' },
  text: { flex: 1 },
});
