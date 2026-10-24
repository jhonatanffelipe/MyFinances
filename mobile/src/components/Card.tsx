import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '../theme/tokens';

/** Cartão branco com borda suave, no estilo do desktop. */
export function Card({ title, right, children, style }: { title?: string; right?: React.ReactNode; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.header}>
          {title ? (
            <Text variant="titleSmall" style={styles.title}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', padding: 14, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', color: COLORS.ink },
});
