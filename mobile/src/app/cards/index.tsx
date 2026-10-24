import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { FAB, Icon, Text } from 'react-native-paper';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { useData } from '../../hooks/useData';
import { listCreditCards } from '../../data/repositories/creditCards';
import { COLORS } from '../../theme/tokens';

export default function Cards() {
  const { data, loading, reload } = useData(() => listCreditCards(), []);
  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading && Boolean(data)} onRefresh={reload} bottomInset={96}>
        {data && data.length === 0 ? <EmptyState icon="credit-card-off-outline" message="Nenhum cartão cadastrado." /> : null}
        {(data || []).map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/cards/${c.id}`)} style={({ pressed }) => [styles.card, { backgroundColor: c.color || COLORS.violet }, pressed && { opacity: 0.85 }, !c.active && { opacity: 0.5 }]}>
            <View style={styles.cardTop}>
              <Icon source="credit-card-chip-outline" size={28} color="#fff" />
              {!c.active ? <Text style={styles.inactive}>Inativo</Text> : null}
            </View>
            <Text style={styles.cardName}>{c.description}</Text>
            <Text style={styles.cardDue}>Vencimento todo dia {c.due_day}</Text>
          </Pressable>
        ))}
      </Screen>
      <FAB icon="plus" color="#fff" style={styles.fab} onPress={() => router.push('/cards/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, gap: 6, minHeight: 130, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inactive: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cardDue: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: COLORS.brand },
});
