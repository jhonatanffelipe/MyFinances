import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { COLOR_PALETTE, COLORS } from '../theme/tokens';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={styles.wrap}>
      <Text variant="labelMedium" style={styles.label}>
        Cor
      </Text>
      <View style={styles.row}>
        {COLOR_PALETTE.map((c) => (
          <Pressable key={c} onPress={() => onChange(c)} style={[styles.swatch, { backgroundColor: c }]} accessibilityLabel={`Cor ${c}`}>
            {value.toLowerCase() === c ? <Icon source="check" size={18} color="#fff" /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: COLORS.inkMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
