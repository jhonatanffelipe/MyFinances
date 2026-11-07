import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { useAppState } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';
import { relativeTime } from '../utils/format';
import { COLORS } from '../theme/tokens';

type Failed = Awaited<ReturnType<typeof appSession.listSyncFailed>>[number];

const TABLE_LABEL: Record<string, string> = {
  movements: 'Lançamento',
  categories: 'Categoria',
  credit_cards: 'Cartão',
  fixed_expenses: 'Lançamento fixo',
  fixed_expense_payments: 'Baixa de lançamento fixo',
};

/** Sincronização: status, forçar, e reenviar/descartar o que o servidor recusou. */
export default function SyncScreen() {
  const { sync, state, notify } = useAppState();
  const [failed, setFailed] = useState<Failed[]>([]);
  const [busy, setBusy] = useState(false);
  const offline = !state.online || sync.phase === 'offline';

  const load = useCallback(() => {
    appSession
      .listSyncFailed()
      .then(setFailed)
      .catch(() => setFailed([]));
  }, []);
  useEffect(load, [load, sync.failed]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      load();
    } catch (err: any) {
      notify(err?.message ?? 'Não foi possível sincronizar');
    } finally {
      setBusy(false);
    }
  };

  const rows: Array<[string, string]> = [
    ['Conexão', offline ? 'Offline' : 'Online'],
    ['Última sincronização', relativeTime(sync.lastSyncAt)],
    ['Aguardando envio', String(sync.pending)],
    ['Recusadas pelo servidor', String(sync.failed)],
  ];
  if (sync.lastConflicts > 0) rows.push(['Conflitos no último envio', `${sync.lastConflicts} (vale a versão mais recente)`]);

  return (
    <Screen>
      <Text style={{ color: COLORS.inkMuted }}>
        Tudo é salvo primeiro neste celular e enviado ao banco da família quando há internet. Sem internet, o app continua funcionando.
      </Text>
      <Card>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.key}>{k}</Text>
            <Text style={styles.value}>{v}</Text>
          </View>
        ))}
        {sync.lastError ? <Text style={{ color: COLORS.danger, marginTop: 8 }}>{sync.lastError}</Text> : null}
      </Card>
      <Button mode="contained" icon="sync" loading={busy} disabled={busy || offline} onPress={() => run(() => appSession.syncNow())}>
        Sincronizar agora
      </Button>

      {failed.length > 0 ? (
        <Card title="Recusadas pelo servidor">
          <Text style={[styles.key, { marginBottom: 8 }]}>
            Reenvie depois de corrigir o problema (ex.: rodar a migração do banco) ou descarte para desfazer a alteração neste celular.
          </Text>
          {failed.map((f) => (
            <View key={f.id} style={styles.failed}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: COLORS.ink }}>
                  {TABLE_LABEL[f.table_name] ?? f.table_name} · {f.attempts} tentativa(s)
                </Text>
                <Text style={styles.key}>{f.last_error}</Text>
              </View>
              <IconButton icon="trash-can-outline" iconColor={COLORS.danger} disabled={busy} onPress={() => run(() => appSession.discardSyncFailed(f.id))} />
            </View>
          ))}
          <Button mode="outlined" disabled={busy || offline} onPress={() => run(() => appSession.retrySyncFailed())}>
            Reenviar recusadas
          </Button>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  key: { color: COLORS.inkMuted, fontSize: 12 },
  value: { color: COLORS.ink, fontWeight: '700', fontSize: 12 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
});
