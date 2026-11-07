import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { List, Text } from 'react-native-paper';
import { Screen } from '../../components/Screen';
import { MemberAvatar } from '../../components/MemberAvatar';
import { useAppState } from '../../contexts/AppStateContext';
import { relativeTime } from '../../utils/format';
import { COLORS } from '../../theme/tokens';

export default function More() {
  const { state, sync, requestSignOut, notify } = useAppState();
  const family = state.families.find((f) => f.id === state.activeFamilyId);
  const offline = !state.online || sync.phase === 'offline';
  const statusText =
    sync.failed > 0
      ? `${sync.failed} recusada(s) pelo servidor`
      : sync.phase === 'syncing'
        ? 'Sincronizando…'
        : offline
          ? `Offline${sync.pending ? ` · ${sync.pending} pendente(s)` : ''}`
          : sync.pending
            ? `${sync.pending} alteração(ões) aguardando envio`
            : `Sincronizado ${relativeTime(sync.lastSyncAt)}`;
  const chevron = (p: { color: string; style?: any }) => <List.Icon {...p} icon="chevron-right" />;

  return (
    <Screen>
      <View style={styles.profile}>
        <MemberAvatar name={state.user?.name} avatarUrl={state.user?.avatar_url} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: '800' }}>
            {state.user?.name}
          </Text>
          <Text variant="bodySmall" style={{ color: COLORS.inkMuted }}>
            {family?.name} · {state.user?.email}
          </Text>
        </View>
      </View>
      <View style={styles.group}>
        <List.Item title="Meu perfil" description="Dados, senha e aparelhos" left={(p) => <List.Icon {...p} icon="account-circle-outline" />} right={chevron} onPress={() => router.push('/profile')} />
        <List.Item title="Membros" description={`${state.members.filter((m) => m.active).length} na família`} left={(p) => <List.Icon {...p} icon="account-group-outline" />} right={chevron} onPress={() => router.push('/members')} />
        <List.Item title="Outra família" description="Criar ou entrar com convite (troque pelo topo da tela)" left={(p) => <List.Icon {...p} icon="home-plus-outline" />} right={chevron} onPress={() => router.push({ pathname: '/family', params: { add: '1' } })} />
      </View>
      <View style={styles.group}>
        <List.Item title="Categorias" left={(p) => <List.Icon {...p} icon="tag-outline" />} right={chevron} onPress={() => router.push('/categories')} />
        <List.Item title="Cartões de crédito" left={(p) => <List.Icon {...p} icon="credit-card-outline" />} right={chevron} onPress={() => router.push('/cards')} />
        <List.Item title="Importar fatura (CSV)" left={(p) => <List.Icon {...p} icon="file-delimited-outline" />} right={chevron} onPress={() => router.push('/import')} />
      </View>
      <View style={styles.group}>
        <List.Item title="Sincronização" description={statusText} left={(p) => <List.Icon {...p} icon="cloud-sync-outline" />} right={chevron} onPress={() => router.push('/sync')} />
        <List.Item
          title="Sair"
          titleStyle={{ color: COLORS.danger }}
          left={(p) => <List.Icon {...p} icon="logout" color={COLORS.danger} />}
          onPress={() => requestSignOut().catch((err) => notify(err?.message))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 4 },
  group: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
});
