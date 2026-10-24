import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, HelperText, List, Text } from 'react-native-paper';
import { Screen } from '../components/Screen';
import { confirm } from '../components/confirm';
import { useSync } from '../contexts/SyncContext';
import { useSession } from '../contexts/SessionContext';
import { disconnect, syncNow } from '../sync/syncManager';
import { relativeTime } from '../utils/format';
import { COLORS } from '../theme/tokens';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Sincronizado',
  syncing: 'Sincronizando…',
  pending: 'Alterações aguardando envio',
  offline: 'Sem conexão',
  error: 'Erro na sincronização',
};

export default function SyncSettings() {
  const { sync } = useSync();
  const { signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <View style={styles.group}>
        <List.Item title="Conta Microsoft" description={sync.accountName || '—'} left={(p) => <List.Icon {...p} icon="microsoft" />} />
        <List.Item title="Arquivo no OneDrive" description={sync.remote?.name || '—'} left={(p) => <List.Icon {...p} icon="database" />} />
        <List.Item
          title={STATUS_LABEL[sync.pendingUpload && sync.status === 'idle' ? 'pending' : sync.status]}
          description={`Última sincronização ${relativeTime(sync.lastSyncAt)}`}
          left={(p) => <List.Icon {...p} icon={sync.status === 'offline' ? 'cloud-off-outline' : 'cloud-check-outline'} />}
        />
        {sync.otherDevice ? (
          <List.Item
            title={`Aberto também em ${sync.otherDevice.deviceName}`}
            description={`Ativo ${relativeTime(sync.otherDevice.updatedAt)}`}
            left={(p) => <List.Icon {...p} icon="monitor-cellphone" color={COLORS.amber} />}
          />
        ) : null}
      </View>
      {error || sync.error ? (
        <HelperText type="error" visible>
          {error || sync.error}
        </HelperText>
      ) : null}
      <Button
        mode="contained"
        icon="sync"
        loading={busy}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await syncNow();
          } catch (err: any) {
            setError(err?.message || 'Falha ao sincronizar');
          } finally {
            setBusy(false);
          }
        }}
      >
        Sincronizar agora
      </Button>
      <Button mode="outlined" icon="folder-swap-outline" onPress={() => router.push('/onboarding/pick')} disabled={busy}>
        Trocar arquivo do banco
      </Button>
      <Text style={styles.help}>
        As alterações são enviadas ao OneDrive automaticamente. Se o mesmo arquivo for alterado no computador antes do
        envio, a versão do celular é guardada como cópia "conflito" na mesma pasta e o app carrega a versão do OneDrive.
      </Text>
      <Button
        mode="text"
        textColor={COLORS.danger}
        icon="logout-variant"
        onPress={async () => {
          if (!(await confirm('Desconectar OneDrive', 'Remover a conta Microsoft e a cópia local do banco deste celular? O arquivo no OneDrive não é alterado.', 'Desconectar'))) return;
          await disconnect();
          await signOut();
          router.replace('/onboarding');
        }}
      >
        Desconectar conta Microsoft
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  help: { color: COLORS.inkFaint, fontSize: 12, lineHeight: 18 },
});
