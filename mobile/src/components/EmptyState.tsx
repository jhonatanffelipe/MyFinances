import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { COLORS } from '../theme/tokens';

export function EmptyState({ icon = 'tray-remove', message }: { icon?: string; message: string }) {
  return (
    <View style={styles.wrap}>
      <Icon source={icon} size={36} color={COLORS.inkFaint} />
      <Text variant="bodyMedium" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  text: { color: COLORS.inkFaint, textAlign: 'center' },
});
