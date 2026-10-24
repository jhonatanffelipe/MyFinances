import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Checkbox, Icon, Text } from 'react-native-paper';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { MonthSelector } from '../../components/MonthSelector';
import { EmptyState } from '../../components/EmptyState';
import { useData } from '../../hooks/useData';
import { defaultYearMonth } from '../../data/date';
import { getDashboardData } from '../../data/repositories/dashboard';
import { setFixedEntryPaid } from '../../data/repositories/fixedEntries';
import { formatCurrency } from '../../utils/format';
import { COLORS } from '../../theme/tokens';

function Kpi({ label, value, trend, icon, color, invertTrend }: { label: string; value: number; trend?: number; icon: string; color: string; invertTrend?: boolean }) {
  const up = (trend || 0) >= 0;
  const good = invertTrend ? !up : up;
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: `${color}1f` }]}>
        <Icon source={icon} size={18} color={color} />
      </View>
      <Text variant="labelSmall" style={styles.kpiLabel}>
        {label}
      </Text>
      <Text variant="titleMedium" style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
        {formatCurrency(value)}
      </Text>
      {trend !== undefined ? (
        <Text style={[styles.trend, { color: good ? COLORS.brandDark : COLORS.danger }]}>
          {up ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs mês anterior
        </Text>
      ) : null}
    </View>
  );
}

function BarList({ items }: { items: { id: number; label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) return <EmptyState icon="chart-bar" message="Sem despesas no mês." />;
  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => (
        <View key={item.id} style={{ gap: 4 }}>
          <View style={styles.barHeader}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.barValue}>{formatCurrency(item.value)}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(item.value / max) * 100}%`, backgroundColor: item.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function Dashboard() {
  const [yearMonth, setYearMonth] = useState(defaultYearMonth());
  const { data, loading, reload } = useData(() => getDashboardData(yearMonth), [yearMonth]);
  const maxHistory = Math.max(...(data?.monthlyHistory || []).flatMap((m) => [m.income, m.expense]), 1);

  return (
    <Screen refreshing={loading && Boolean(data)} onRefresh={reload}>
      <MonthSelector value={yearMonth} onChange={setYearMonth} />
      {data ? (
        <>
          <View style={styles.kpiGrid}>
            <Kpi label="Saldo total" value={data.totalBalance} trend={data.balanceTrend} icon="wallet-outline" color={COLORS.ink} />
            <Kpi label="Receitas do mês" value={data.monthIncome} trend={data.incomeTrend} icon="arrow-down-circle-outline" color={COLORS.brand} />
            <Kpi label="Despesas do mês" value={data.monthExpense} trend={data.expenseTrend} icon="arrow-up-circle-outline" color={COLORS.danger} invertTrend />
            <Kpi label="Despesas fixas" value={data.fixedExpensesTotal} icon="calendar-sync-outline" color={COLORS.violet} />
          </View>

          <Card title="Receitas x despesas (5 meses)">
            <View style={styles.chart}>
              {data.monthlyHistory.map((m) => (
                <View key={m.month} style={styles.chartCol}>
                  <View style={styles.chartBars}>
                    <View style={[styles.chartBar, { height: `${(m.income / maxHistory) * 100}%`, backgroundColor: COLORS.brand }]} />
                    <View style={[styles.chartBar, { height: `${(m.expense / maxHistory) * 100}%`, backgroundColor: COLORS.inkSoft }]} />
                  </View>
                  <Text style={styles.chartLabel}>{m.month}</Text>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.brand }]} />
              <Text style={styles.legendText}>Receitas</Text>
              <View style={[styles.legendDot, { backgroundColor: COLORS.inkSoft }]} />
              <Text style={styles.legendText}>Despesas</Text>
            </View>
          </Card>

          <Card title="Despesas por categoria">
            <BarList items={data.expensesByCategory} />
          </Card>

          <Card title="Despesas por cartão">
            <BarList items={data.expensesByCard} />
          </Card>

          <Card title="Despesas fixas do mês" right={<Text style={styles.link} onPress={() => router.push('/(tabs)/fixed')}>Ver todas</Text>}>
            {data.upcomingFixedExpenses.length === 0 ? (
              <EmptyState icon="calendar-blank-outline" message="Nenhuma despesa fixa ativa." />
            ) : (
              data.upcomingFixedExpenses.map((f) => (
                <View key={f.id} style={styles.fixedRow}>
                  <Checkbox.Android
                    status={f.paid ? 'checked' : 'unchecked'}
                    color={COLORS.brand}
                    onPress={async () => {
                      await setFixedEntryPaid(f.id, yearMonth, !f.paid);
                      reload();
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fixedName, f.paid ? styles.paid : null]} numberOfLines={1}>
                      {f.description}
                    </Text>
                    <Text style={styles.fixedDate}>Vence em {f.formattedDueDate}</Text>
                  </View>
                  <Text style={styles.fixedValue}>{formatCurrency(f.amount)}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexBasis: '47%', flexGrow: 1, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', padding: 12, gap: 4 },
  kpiIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { color: COLORS.inkMuted },
  kpiValue: { fontWeight: '800', color: COLORS.ink },
  trend: { fontSize: 10, fontWeight: '700' },
  chart: { flexDirection: 'row', height: 140, alignItems: 'flex-end', justifyContent: 'space-between' },
  chartCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  chartBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  chartBar: { width: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  chartLabel: { fontSize: 11, color: COLORS.inkMuted },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.inkMuted, marginRight: 8 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barLabel: { flex: 1, color: COLORS.ink, fontSize: 13 },
  barValue: { fontWeight: '700', color: COLORS.ink, fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  link: { color: COLORS.brandDark, fontWeight: '700', fontSize: 12 },
  fixedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fixedName: { color: COLORS.ink, fontWeight: '600' },
  paid: { textDecorationLine: 'line-through', color: COLORS.inkFaint },
  fixedDate: { color: COLORS.inkFaint, fontSize: 11 },
  fixedValue: { fontWeight: '700', color: COLORS.ink },
});
