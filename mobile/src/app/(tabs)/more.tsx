import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { List, Text } from 'react-native-paper';
import { Screen } from '../../components/Screen';
import { useSession } from '../../contexts/SessionContext';
import { useSync } from '../../contexts/SyncContext';
import { relativeTime } from '../../utils/format';
import { COLORS } from '../../theme/tokens';

export default function More() {
  const { user, signOut } = useSession();
  const { sync } = useSync();
  const statusText =
    sync.status === 'syncing'
      ? 'Sincronizando…'
      : sync.pendingUpload
        ? 'Alterações aguardando envio'
        : `Sincronizado ${relativeTime(sync.lastSyncAt)}`;

  return (
    <Screen>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || 'U').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View>
          <Text variant="titleMedium" style={{ fontWeight: '800' }}>
            {user?.name}
          </Text>
          <Text variant="bodySmall" style={{ color: COLORS.inkMuted }}>
            {sync.remote?.name}
          </Text>
        </View>
      </View>
      <View style={styles.group}>
        <List.Item title="Categorias" left={(p) => <List.Icon {...p} icon="tag-outline" />} right={(p) => <List.Icon {...p} icon="chevron-right" />} onPress={() => router.push('/categories')} />
        <List.Item title="Cartões de crédito" left={(p) => <List.Icon {...p} icon="credit-card-outline" />} right={(p) => <List.Icon {...p} icon="chevron-right" />} onPress={() => router.push('/cards')} />
        <List.Item title="Importar fatura (CSV)" left={(p) => <List.Icon {...p} icon="file-delimited-outline" />} right={(p) => <List.Icon {...p} icon="chevron-right" />} onPress={() => router.push('/import')} />
      </View>
      <View style={styles.group}>
        <List.Item
          title="Sincronização com OneDrive"
          description={statusText}
          left={(p) => <List.Icon {...p} icon="cloud-sync-outline" />}
          right={(p) => <List.Icon {...p} icon="chevron-right" />}
          onPress={() => router.push('/sync')}
        />
        <List.Item
          title="Sair"
          titleStyle={{ color: COLORS.danger }}
          left={(p) => <List.Icon {...p} icon="logout" color={COLORS.danger} />}
          onPress={async () => {
            await signOut();
            router.replace('/login');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  group: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
});
