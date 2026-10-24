import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Checkbox, HelperText, Icon, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hasUsers, listUserNames, login, registerUser } from '../data/repositories/auth';
import { confirm } from '../components/confirm';
import { useSession } from '../contexts/SessionContext';
import { useSync } from '../contexts/SyncContext';
import { syncNow } from '../sync/syncManager';
import { relativeTime } from '../utils/format';
import { COLORS } from '../theme/tokens';

/** Login com os mesmos usuários do desktop (ou cadastro, se o banco ainda não tiver). */
export default function Login() {
  const { signIn } = useSession();
  const { sync, dataVersion } = useSync();
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recarrega os usuários quando o banco é substituído pela versão do OneDrive
  useEffect(() => {
    (async () => {
      const exists = await hasUsers();
      setMode(exists ? 'login' : 'register');
      if (exists) {
        const names = await listUserNames();
        if (names.length === 1) setName(names[0]);
      }
    })().catch((err) => setError(err?.message));
  }, [dataVersion]);

  /** Força a conferência com o OneDrive (ex.: senha alterada no computador). */
  const forceSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncNow();
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar com o OneDrive');
    } finally {
      setSyncing(false);
    }
  };

  /** Volta à escolha do arquivo; ao escolher, a cópia local é substituída pela do OneDrive. */
  const pickAgain = async () => {
    if (
      sync.pendingUpload &&
      !(await confirm(
        'Selecionar o arquivo novamente',
        'Há alterações deste celular que ainda não foram enviadas ao OneDrive. Ao escolher o arquivo, elas serão descartadas.',
        'Continuar'
      ))
    ) {
      return;
    }
    router.push('/onboarding/pick');
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = mode === 'register' ? await registerUser(name, password) : await login(name, password);
      if (!res.success || !res.user) {
        setError(res.error || 'Não foi possível entrar');
        return;
      }
      await signIn(res.user, remember);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Erro ao entrar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Icon source="wallet" size={34} color="#fff" />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            {mode === 'register' ? 'Crie seu usuário' : 'Bem-vindo de volta'}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {mode === 'register'
              ? 'Este banco ainda não tem usuário. O mesmo login valerá no computador.'
              : 'Entre com o mesmo usuário e senha do MyFinances desktop.'}
          </Text>
        </View>
        <View style={styles.form}>
          <TextInput mode="outlined" label="Usuário" value={name} onChangeText={setName} autoCapitalize="none" />
          <TextInput mode="outlined" label="Senha" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} />
          <Checkbox.Item
            label="Manter conectado neste celular"
            status={remember ? 'checked' : 'unchecked'}
            onPress={() => setRemember(!remember)}
            mode="android"
            position="leading"
            labelStyle={{ textAlign: 'left' }}
            style={{ paddingHorizontal: 0 }}
          />
          {error ? (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          ) : null}
          <Button mode="contained" onPress={submit} loading={busy} disabled={busy || !mode} contentStyle={{ paddingVertical: 6 }}>
            {mode === 'register' ? 'Criar e entrar' : 'Entrar'}
          </Button>
          {busy && mode === 'login' ? (
            <Text variant="bodySmall" style={styles.hint}>
              Verificando a senha (pode levar alguns segundos no celular)…
            </Text>
          ) : null}
          {sync.remote ? (
            <View style={styles.sync}>
              <Button mode="text" icon="sync" onPress={forceSync} loading={syncing} disabled={syncing || busy}>
                Sincronizar com o OneDrive
              </Button>
              <Text variant="bodySmall" style={styles.hint}>
                Última sincronização {relativeTime(sync.lastSyncAt)}
              </Text>
            </View>
          ) : null}
          {sync.signedIn ? (
            <Button mode="text" icon="folder-search-outline" onPress={pickAgain} disabled={syncing || busy}>
              Selecionar o arquivo novamente
            </Button>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  inner: { flex: 1, padding: 24, justifyContent: 'center', gap: 28 },
  hero: { alignItems: 'center', gap: 10 },
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', color: COLORS.ink },
  subtitle: { textAlign: 'center', color: COLORS.inkMuted },
  form: { gap: 12 },
  hint: { textAlign: 'center', color: COLORS.inkFaint },
  sync: { alignItems: 'center', marginTop: 4 },
});
