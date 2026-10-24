import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

/** Etiqueta colorida (categoria, cartão, tipo). */
export function Badge({ label, color = '#64748b', dot = true }: { label: string; color?: string; dot?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1f`, borderColor: `${color}40` }]}>
      {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: 200,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700' },
});
