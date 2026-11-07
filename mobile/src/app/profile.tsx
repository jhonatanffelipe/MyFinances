import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, TextInput } from 'react-native-paper';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { confirm } from '../components/confirm';
import { ErrorText, InfoBox } from '../components/Onboarding';
import { router } from 'expo-router';
import { useAppState, useCanManageFamily } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';
import { relativeTime } from '../utils/format';
import { COLORS } from '../theme/tokens';

type Device = Awaited<ReturnType<typeof appSession.listDevices>>[number];

/** Perfil: dados, senha, aparelhos conectados e o banco conectado. */
export default function Profile() {
  const { state, apply, requestSignOut, notify } = useAppState();
  const canManage = useCanManageFamily();
  const user = state.user!;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);

  const loadDevices = useCallback(() => {
    appSession
      .listDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);
  useEffect(loadDevices, [loadDevices, state.online]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setError(null);
    setOk(null);
    try {
      const message = await fn();
      if (message) setOk(message);
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível concluir');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (d: Device) => {
    if (!(await confirm(`Desconectar ${d.deviceName}?`, 'O aparelho perde o acesso à sua conta (em até 1 hora).', 'Desconectar'))) return;
    try {
      await appSession.revokeDevice(d.id);
      loadDevices();
    } catch (err: any) {
      notify(err?.message ?? 'Não foi possível desconectar');
    }
  };

  return (
    <Screen>
      {ok ? <InfoBox tone="success" icon="check-circle-outline" text={ok} /> : null}
      <ErrorText message={error} />

      <Card title="Dados pessoais">
        <View style={styles.gap}>
          <TextInput mode="outlined" label="Nome" value={name} onChangeText={setName} />
          <TextInput mode="outlined" label="E-mail" value={user.email} disabled />
          <TextInput mode="outlined" label="Telefone (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Button
            mode="contained"
            loading={busy === 'profile'}
            disabled={!!busy || !state.online}
            onPress={() => run('profile', async () => (apply(await appSession.updateProfile({ name, phone: phone || null, avatar_url: user.avatar_url })), 'Perfil salvo.'))}
          >
            Salvar
          </Button>
        </View>
      </Card>

      <Card title="Senha">
        <View style={styles.gap}>
          <TextInput mode="outlined" label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          <Button
            mode="outlined"
            loading={busy === 'password'}
            disabled={!!busy || !password || !state.online}
            onPress={() =>
              run('password', async () => {
                await appSession.changePassword(password);
                setPassword('');
                return 'Senha alterada.';
              })
            }
          >
            Alterar senha
          </Button>
        </View>
      </Card>

      <Card title="Aparelhos conectados">
        {devices === null ? (
          <Text style={styles.muted}>Carregando…</Text>
        ) : devices.length === 0 ? (
          <Text style={styles.muted}>{state.online ? 'Nenhum aparelho registrado.' : 'Conecte-se à internet para ver os aparelhos.'}</Text>
        ) : (
          devices.map((d) => (
            <View key={d.id} style={styles.device}>
              <Icon source={d.platform === 'desktop' ? 'laptop' : 'cellphone'} size={22} color={COLORS.inkMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>{d.deviceName}</Text>
                <Text style={styles.muted}>Ativo {relativeTime(d.lastSeenAt)}</Text>
              </View>
              {d.current ? (
                <Text style={{ color: COLORS.brandDark, fontWeight: '700', fontSize: 12 }}>Este celular</Text>
              ) : (
                <Button compact textColor={COLORS.danger} disabled={!state.online} onPress={() => revoke(d)}>
                  Desconectar
                </Button>
              )}
            </View>
          ))
        )}
        <Text style={[styles.muted, { marginTop: 8 }]}>Para conectar outro celular, use Perfil → Conectar celular no computador.</Text>
      </Card>

      {canManage ? (
        <Card title="Banco da v1">
          <Text style={styles.muted}>Importe o db_myfinances.sqlite da v1 (o seu ou o de outra pessoa da família). Importar de novo não duplica nada.</Text>
          <Button mode="outlined" icon="database-import-outline" style={{ marginTop: 10 }} onPress={() => router.push('/import-v1')}>
            Importar banco da v1
          </Button>
        </Card>
      ) : null}

      <Card title="Banco conectado">
        <Text style={styles.muted}>Projeto {state.connection?.projectRef}</Text>
        <Text style={styles.muted} numberOfLines={1}>
          {state.connection?.url}
        </Text>
        <View style={[styles.gap, { marginTop: 10 }]}>
          <Button
            mode="outlined"
            loading={busy === 'test'}
            disabled={!!busy || !state.online}
            onPress={() => run('test', async () => `Conexão ok · banco na versão ${(await appSession.testConnection()).schemaVersion}.`)}
          >
            Testar conexão
          </Button>
          <Button textColor={COLORS.danger} onPress={() => requestSignOut({ forgetConnection: true })}>
            Trocar de banco (sai da conta)
          </Button>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  muted: { color: COLORS.inkMuted, fontSize: 12 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  deviceName: { fontWeight: '700', color: COLORS.ink },
});
