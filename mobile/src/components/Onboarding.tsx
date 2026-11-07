import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { HelperText, Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/tokens';

/** Moldura das telas de entrada (conectar, login, família). */
export function OnboardingShell({
  icon = 'wallet-outline',
  title,
  subtitle,
  children,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.badge}>
            <Icon source={icon} size={34} color={COLORS.brand} />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <HelperText type="error" visible style={{ paddingHorizontal: 0 }}>
      {message}
    </HelperText>
  );
}

export function InfoBox({ icon = 'information-outline', text, tone = 'info' }: { icon?: string; text: string; tone?: 'info' | 'success' | 'warn' }) {
  const colors = {
    info: { bg: '#f1f5f9', fg: COLORS.inkMuted },
    success: { bg: COLORS.brandSoft, fg: COLORS.brandDark },
    warn: { bg: COLORS.amberSoft, fg: '#92400e' },
  }[tone];
  return (
    <View style={[styles.info, { backgroundColor: colors.bg }]}>
      <Icon source={icon} size={18} color={colors.fg} />
      <Text style={{ flex: 1, color: colors.fg, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

/** Executa uma ação assíncrona controlando "carregando" e a mensagem de erro. */
export function useAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err: any) {
      setError(err?.message ?? 'Erro inesperado');
      return undefined;
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, setError, run };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  content: { padding: 24, paddingTop: 40, alignItems: 'center', flexGrow: 1 },
  badge: { width: 72, height: 72, borderRadius: 22, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontWeight: '800', color: COLORS.ink, textAlign: 'center' },
  subtitle: { color: COLORS.inkMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  body: { alignSelf: 'stretch', marginTop: 24, gap: 12 },
  info: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, alignItems: 'flex-start' },
});
