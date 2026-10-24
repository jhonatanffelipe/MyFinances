import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ActivityIndicator, Button, HelperText, List, Text } from 'react-native-paper';
import { DriveItem, listChildren } from '../../sync/graph';
import { connectRemoteFile } from '../../sync/syncManager';
import { useSync } from '../../contexts/SyncContext';
import { COLORS } from '../../theme/tokens';

const DB_EXTENSIONS = ['.sqlite', '.sqlite3', '.db'];

function isDatabase(item: DriveItem) {
  const name = item.name.toLowerCase();
  return Boolean(item.file) && DB_EXTENSIONS.some((ext) => name.endsWith(ext)) && !name.includes('.conflito-');
}

/** Navegador de pastas do OneDrive para escolher o arquivo do banco. */
export default function PickDatabase() {
  const { sync } = useSync();
  const [path, setPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'OneDrive' }]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = path[path.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const children = await listChildren(current.id);
      setItems(children.filter((c) => c.folder || isDatabase(c)).sort((a, b) => Number(Boolean(b.folder)) - Number(Boolean(a.folder))));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível listar a pasta');
    } finally {
      setLoading(false);
    }
  }, [current.id]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = async (item: DriveItem) => {
    setConnecting(item.id);
    setError(null);
    try {
      await connectRemoteFile(item);
      router.replace('/login');
    } catch (err: any) {
      setError(err?.message || 'Falha ao baixar o arquivo');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="bodySmall" style={styles.account}>
          {sync.accountName ? `Conta: ${sync.accountName}` : 'Conta Microsoft conectada'}
        </Text>
        <Text variant="titleSmall" numberOfLines={1} style={styles.breadcrumb}>
          {path.map((p) => p.name).join(' / ')}
        </Text>
        {path.length > 1 ? (
          <Button compact icon="arrow-up" mode="text" style={{ alignSelf: 'flex-start' }} onPress={() => setPath(path.slice(0, -1))}>
            Voltar
          </Button>
        ) : null}
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brand} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhuma pasta ou arquivo de banco (.sqlite, .db) aqui.</Text>
          }
          renderItem={({ item }) =>
            item.folder ? (
              <List.Item
                title={item.name}
                description={`${item.folder.childCount} item(ns)`}
                left={(p) => <List.Icon {...p} icon="folder" color={COLORS.amber} />}
                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                onPress={() => setPath([...path, { id: item.id, name: item.name }])}
              />
            ) : (
              <List.Item
                title={item.name}
                description={`${((item.size || 0) / 1024).toFixed(0)} KB · alterado em ${new Date(item.lastModifiedDateTime || '').toLocaleString('pt-BR')}`}
                left={(p) => <List.Icon {...p} icon="database" color={COLORS.brand} />}
                right={() => (connecting === item.id ? <ActivityIndicator color={COLORS.brand} /> : null)}
                disabled={Boolean(connecting)}
                onPress={() => choose(item)}
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { padding: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: COLORS.line, backgroundColor: COLORS.canvas },
  account: { color: COLORS.inkMuted },
  breadcrumb: { color: COLORS.ink, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.inkFaint, padding: 32 },
});
