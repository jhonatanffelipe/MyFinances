import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Checkbox, HelperText, Icon, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hasUsers, listUserNames, login, registerUser } from '../data/repositories/auth';
import { useSession } from '../contexts/SessionContext';
import { COLORS } from '../theme/tokens';

/** Login com os mesmos usuários do desktop (ou cadastro, se o banco ainda não tiver). */
export default function Login() {
  const { signIn } = useSession();
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const exists = await hasUsers();
      setMode(exists ? 'login' : 'register');
      if (exists) {
        const names = await listUserNames();
        if (names.length === 1) setName(names[0]);
      }
    })().catch((err) => setError(err?.message));
  }, []);

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
});
