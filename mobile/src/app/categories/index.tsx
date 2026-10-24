import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { FAB, ProgressBar, SegmentedButtons, Text } from 'react-native-paper';
import { Screen } from '../../components/Screen';
import { MonthSelector } from '../../components/MonthSelector';
import { EmptyState } from '../../components/EmptyState';
import { useData } from '../../hooks/useData';
import { defaultYearMonth } from '../../data/date';
import { listCategories } from '../../data/repositories/categories';
import { TransactionType } from '../../data/types';
import { formatCurrency } from '../../utils/format';
import { COLORS } from '../../theme/tokens';

export default function Categories() {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [yearMonth, setYearMonth] = useState(defaultYearMonth());
  const { data, loading, reload } = useData(() => listCategories({ type, yearMonth }), [type, yearMonth]);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading && Boolean(data)} onRefresh={reload} bottomInset={96}>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as TransactionType)}
          buttons={[
            { value: 'EXPENSE', label: 'Despesas' },
            { value: 'INCOME', label: 'Receitas' },
          ]}
        />
        <MonthSelector value={yearMonth} onChange={setYearMonth} />
        <View style={styles.list}>
          {data && data.length === 0 ? <EmptyState icon="tag-outline" message="Nenhuma categoria." /> : null}
          {(data || []).map((c) => {
            const limit = Number(c.monthly_limit || 0);
            const consumed = Number(c.consumed || 0);
            const ratio = limit > 0 ? Math.min(consumed / limit, 1) : 0;
            return (
              <Pressable key={c.id} onPress={() => router.push(`/categories/${c.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f1f5f9' }]}>
                <View style={[styles.dot, { backgroundColor: c.color || '#94a3b8' }]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.line}>
                    <Text style={styles.name} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.value}>{formatCurrency(consumed)}</Text>
                  </View>
                  {limit > 0 ? (
                    <>
                      <ProgressBar progress={ratio} color={ratio >= 1 ? COLORS.danger : c.color || COLORS.brand} style={styles.bar} />
                      <Text style={styles.small}>Limite {formatCurrency(limit)}</Text>
                    </>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Screen>
      <FAB icon="plus" color="#fff" style={styles.fab} onPress={() => router.push({ pathname: '/categories/[id]', params: { id: 'new', type } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontWeight: '700', color: COLORS.ink },
  value: { fontWeight: '700', color: COLORS.ink },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#f1f5f9' },
  small: { fontSize: 11, color: COLORS.inkFaint },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: COLORS.brand },
});
