import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Checkbox, FAB, SegmentedButtons, Text } from 'react-native-paper';
import { Screen } from '../../components/Screen';
import { MonthSelector } from '../../components/MonthSelector';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { useData } from '../../hooks/useData';
import { useAppState } from '../../contexts/AppStateContext';
import { appSession } from '../../engine/session';
import { defaultYearMonth, formatDate, type TransactionType } from '@myfinances/core';
import { RECURRENCE_LABEL, formatCurrency } from '../../utils/format';
import { COLORS } from '../../theme/tokens';

/** Despesas e receitas fixas, com baixa (pago/recebido) do mês. */
export default function Fixed() {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [yearMonth, setYearMonth] = useState(defaultYearMonth());
  const { notify } = useAppState();
  const { data, loading, reload } = useData(async (core) => (await core.fixedExpenses.list.execute({ type, yearMonth, perPage: 9999 })).data, [type, yearMonth]);
  const active = (data || []).filter((f) => f.active);
  const total = active.reduce((s, f) => s + Number(f.amount), 0);
  const paidTotal = active.filter((f) => f.paid).reduce((s, f) => s + Number(f.amount), 0);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading && Boolean(data)} onRefresh={reload} bottomInset={96}>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as TransactionType)}
          buttons={[
            { value: 'EXPENSE', label: 'Despesas', icon: 'arrow-up-circle-outline' },
            { value: 'INCOME', label: 'Receitas', icon: 'arrow-down-circle-outline' },
          ]}
        />
        <MonthSelector value={yearMonth} onChange={setYearMonth} />
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {type === 'EXPENSE' ? 'Pago' : 'Recebido'}: <Text style={styles.bold}>{formatCurrency(paidTotal)}</Text> de{' '}
            <Text style={styles.bold}>{formatCurrency(total)}</Text>
          </Text>
        </View>
        <View style={styles.list}>
          {data && data.length === 0 ? (
            <EmptyState icon="calendar-blank-outline" message={type === 'EXPENSE' ? 'Nenhuma despesa fixa cadastrada.' : 'Nenhuma receita fixa cadastrada.'} />
          ) : null}
          {(data || []).map((f) => (
            <Pressable key={f.id} onPress={() => router.push({ pathname: '/fixed/[id]', params: { id: String(f.id), type } })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f1f5f9' }, !f.active && { opacity: 0.5 }]}>
              <Checkbox.Android
                status={f.paid ? 'checked' : 'unchecked'}
                color={COLORS.brand}
                disabled={!f.active}
                onPress={async () => {
                  try {
                    await appSession.core().fixedExpenses.setPaid.execute(f.id, yearMonth, !f.paid);
                    reload();
                  } catch (err: any) {
                    notify(err?.message ?? 'Não foi possível registrar a baixa');
                  }
                }}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.desc, f.paid ? styles.paid : null]} numberOfLines={1}>
                  {f.description}
                </Text>
                <View style={styles.meta}>
                  <Text style={styles.small}>
                    Dia {f.due_day} · {RECURRENCE_LABEL[f.recurrence ?? 'MONTHLY']}
                    {f.end_date ? ` · até ${formatDate(f.end_date)}` : ''}
                    {!f.active ? ' · inativo' : ''}
                    {f.member_name ? ` · ${f.member_name.split(' ')[0]}` : ''}
                  </Text>
                  {f.category_name ? <Badge label={f.category_name} color={f.category_color || '#64748b'} /> : null}
                  {f.credit_card_name ? <Badge label={f.credit_card_name} color={f.credit_card_color || COLORS.violet} dot={false} /> : null}
                </View>
              </View>
              <Text style={styles.amount}>{formatCurrency(f.amount)}</Text>
            </Pressable>
          ))}
        </View>
      </Screen>
      <FAB
        icon="plus"
        color="#fff"
        style={styles.fab}
        label={type === 'EXPENSE' ? 'Despesa fixa' : 'Receita fixa'}
        onPress={() => router.push({ pathname: '/fixed/[id]', params: { id: 'new', type } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', padding: 12 },
  summaryText: { color: COLORS.inkMuted, textAlign: 'center' },
  bold: { fontWeight: '800', color: COLORS.ink },
  list: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  desc: { fontWeight: '700', color: COLORS.ink },
  paid: { textDecorationLine: 'line-through', color: COLORS.inkFaint },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  small: { fontSize: 11, color: COLORS.inkFaint },
  amount: { fontWeight: '800', color: COLORS.ink },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: COLORS.brand },
});
