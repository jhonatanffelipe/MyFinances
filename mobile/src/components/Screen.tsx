import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS } from '../theme/tokens';
import { SyncBanner } from './SyncBanner';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** Espaço extra no fim (ex.: para o botão flutuante). */
  bottomInset?: number;
}

/** Container padrão das telas, com puxar-para-atualizar e avisos de sincronização. */
export function Screen({ children, scroll = true, refreshing = false, onRefresh, contentStyle, bottomInset = 24 }: ScreenProps) {
  if (!scroll) {
    return (
      <View style={styles.root}>
        <SyncBanner />
        <View style={[styles.flex, contentStyle]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.brand]} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      <SyncBanner />
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  flex: { flex: 1 },
  content: { padding: 16, gap: 12 },
});
