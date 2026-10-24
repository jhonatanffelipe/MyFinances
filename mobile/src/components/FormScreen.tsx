import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText } from 'react-native-paper';
import { COLORS } from '../theme/tokens';

/** Layout dos formulários: campos com rolagem e botões fixos no rodapé. */
export function FormScreen({
  children,
  error,
  saving,
  onSave,
  onDelete,
  saveLabel = 'Salvar',
}: {
  children: React.ReactNode;
  error?: string | null;
  saving?: boolean;
  onSave: () => void;
  onDelete?: () => void;
  saveLabel?: string;
}) {
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {onDelete ? (
          <Button mode="outlined" textColor={COLORS.danger} style={styles.delete} onPress={onDelete} disabled={saving} icon="trash-can-outline">
            Excluir
          </Button>
        ) : null}
        <Button mode="contained" style={styles.save} onPress={onSave} loading={saving} disabled={saving}>
          {saveLabel}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  content: { padding: 16, gap: 14 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: COLORS.surface },
  delete: { borderColor: '#fecaca' },
  save: { flex: 1 },
});
