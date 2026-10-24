import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { shiftYearMonth, yearMonthLabel } from '../data/date';
import { COLORS } from '../theme/tokens';

export function MonthSelector({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  return (
    <View style={styles.row}>
      <IconButton icon="chevron-left" onPress={() => onChange(shiftYearMonth(value, -1))} accessibilityLabel="Mês anterior" />
      <Text variant="titleMedium" style={styles.label}>
        {yearMonthLabel(value)}
      </Text>
      <IconButton icon="chevron-right" onPress={() => onChange(shiftYearMonth(value, 1))} accessibilityLabel="Próximo mês" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  label: { fontWeight: '700', color: COLORS.ink },
});
