import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Chip, FAB, Icon, Menu, Searchbar, Text } from 'react-native-paper';
import { Screen } from '../../components/Screen';
import { MonthSelector } from '../../components/MonthSelector';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { confirm } from '../../components/confirm';
import { useData } from '../../hooks/useData';
import { defaultYearMonth, formatDate, resolveYearMonth } from '../../data/date';
import { deleteMovement, listMovements } from '../../data/repositories/movements';
import { listCreditCards } from '../../data/repositories/creditCards';
import { Movement } from '../../data/types';
import { formatCurrency, signedCurrency } from '../../utils/format';
import { COLORS } from '../../theme/tokens';

type CardFilter = 'all' | 'none' | number;

function MovementRow({ m, onPress, onLongPress, nested }: { m: Movement; onPress: () => void; onLongPress?: () => void; nested?: boolean }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [styles.row, nested && styles.nestedRow, pressed && styles.pressed]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.desc} numberOfLines={1}>
          {m.description}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.date}>{formatDate(m.date)}</Text>
          <Badge label={m.category_name || 'Sem categoria'} color={m.category_color || '#64748b'} />
          {!nested && m.credit_card_name ? <Badge label={m.credit_card_name} color={m.credit_card_color || COLORS.violet} dot={false} /> : null}
        </View>
      </View>
      <Text style={[styles.amount, { color: m.type === 'INCOME' ? COLORS.brandDark : COLORS.ink }]}>{signedCurrency(m.amount, m.type)}</Text>
    </Pressable>
  );
}

export default function Movements() {
  const [yearMonth, setYearMonth] = useState(defaultYearMonth());
  const [search, setSearch] = useState('');
  const [cardFilter, setCardFilter] = useState<CardFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fabOpen, setFabOpen] = useState(false);
  const [invoiceMenu, setInvoiceMenu] = useState<Movement | null>(null);

  const period = resolveYearMonth(yearMonth);
  const { data: cards } = useData(() => listCreditCards(), []);
  const { data, loading, reload } = useData(
    () =>
      listMovements({
        startDate: period.start,
        endDate: period.end,
        search: search.trim() || undefined,
        type: typeFilter,
        creditCardId: cardFilter === 'all' ? undefined : cardFilter,
      }),
    [period.start, period.end, search, cardFilter, typeFilter]
  );

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const askDelete = async (m: Movement) => {
    if (await confirm('Excluir movimentação', `Excluir "${m.description}"?`)) {
      await deleteMovement(m.id);
      reload();
    }
  };

  const summary = data?.summary;

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading && Boolean(data)} onRefresh={reload} bottomInset={96}>
        <MonthSelector value={yearMonth} onChange={setYearMonth} />
        <Searchbar placeholder="Buscar descrição ou anotação" value={search} onChangeText={setSearch} style={styles.search} inputStyle={{ fontSize: 14 }} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip selected={cardFilter === 'all'} onPress={() => setCardFilter('all')} compact>
            Todos
          </Chip>
          <Chip selected={cardFilter === 'none'} onPress={() => setCardFilter('none')} compact icon="cash">
            Sem cartão
          </Chip>
          {(cards || []).map((c) => (
            <Chip key={c.id} selected={cardFilter === c.id} onPress={() => setCardFilter(c.id)} compact icon="credit-card-outline">
              {c.description}
            </Chip>
          ))}
        </ScrollView>
        <View style={styles.chips}>
          {(['ALL', 'INCOME', 'EXPENSE'] as const).map((t) => (
            <Chip key={t} selected={typeFilter === t} onPress={() => setTypeFilter(t)} compact>
              {t === 'ALL' ? 'Todos os tipos' : t === 'INCOME' ? 'Entradas' : 'Saídas'}
            </Chip>
          ))}
        </View>

        {summary ? (
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Entradas</Text>
              <Text style={[styles.summaryValue, { color: COLORS.brandDark }]}>{formatCurrency(summary.totalIncome)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Saídas</Text>
              <Text style={[styles.summaryValue, { color: COLORS.danger }]}>{formatCurrency(summary.totalExpense)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Saldo</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalIncome - summary.totalExpense)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.list}>
          {data && data.data.length === 0 ? <EmptyState message="Nenhuma movimentação no período." /> : null}
          {(data?.data || []).map((m) => {
            if (!m.isGroupedCard) {
              return <MovementRow key={m.id} m={m} onPress={() => router.push(`/movement/${m.id}`)} onLongPress={() => askDelete(m)} />;
            }
            const key = m.groupKey || String(m.id);
            const isOpen = expanded.has(key);
            return (
              <View key={key} style={[styles.invoice, { borderLeftColor: m.credit_card_color || COLORS.violet }]}>
                <Menu
                  visible={invoiceMenu?.groupKey === m.groupKey}
                  onDismiss={() => setInvoiceMenu(null)}
                  anchor={
                    <Pressable onPress={() => toggle(key)} onLongPress={() => setInvoiceMenu(m)} style={styles.invoiceHeader}>
                      <Icon source={isOpen ? 'chevron-down' : 'chevron-right'} size={20} color={COLORS.inkMuted} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.desc}>{m.description}</Text>
                        <Text style={styles.date}>
                          Vencimento {formatDate(m.date)} · {m.cardMovementCount} lançamento(s)
                        </Text>
                      </View>
                      <Text style={styles.amount}>- {formatCurrency(m.amount)}</Text>
                    </Pressable>
                  }
                >
                  <Menu.Item
                    leadingIcon="filter-outline"
                    title="Ver só este cartão"
                    onPress={() => {
                      setInvoiceMenu(null);
                      setCardFilter(m.credit_card_id!);
                    }}
                  />
                  <Menu.Item
                    leadingIcon="trash-can-outline"
                    title="Excluir todos os lançamentos"
                    titleStyle={{ color: COLORS.danger }}
                    onPress={() => {
                      setInvoiceMenu(null);
                      router.push({ pathname: '/bulk-delete', params: { cardId: String(m.credit_card_id), yearMonth: m.date.substring(0, 7) } });
                    }}
                  />
                </Menu>
                {isOpen
                  ? m.cardMovements?.map((child) => (
                      <MovementRow key={child.id} m={child} nested onPress={() => router.push(`/movement/${child.id}`)} onLongPress={() => askDelete(child)} />
                    ))
                  : null}
              </View>
            );
          })}
        </View>
        {data && data.data.length > 0 ? (
          <Text style={styles.hint}>Toque para editar · segure para excluir · segure a fatura para mais opções</Text>
        ) : null}
      </Screen>

      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'close' : 'plus'}
        color="#fff"
        fabStyle={{ backgroundColor: COLORS.brand }}
        onStateChange={({ open }) => setFabOpen(open)}
        actions={[
          { icon: 'trash-can-outline', label: 'Excluir por cartão', onPress: () => router.push({ pathname: '/bulk-delete', params: { yearMonth } }) },
          { icon: 'file-delimited-outline', label: 'Importar fatura (CSV)', onPress: () => router.push('/import') },
          { icon: 'plus', label: 'Nova transação', onPress: () => router.push('/movement/new') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', elevation: 0 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summary: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', padding: 12 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryLabel: { fontSize: 11, color: COLORS.inkMuted },
  summaryValue: { fontWeight: '800', color: COLORS.ink, fontSize: 13 },
  list: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  nestedRow: { paddingLeft: 40, backgroundColor: '#fafafa' },
  pressed: { backgroundColor: '#f1f5f9' },
  desc: { fontWeight: '700', color: COLORS.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  date: { fontSize: 11, color: COLORS.inkFaint },
  amount: { fontWeight: '800', color: COLORS.ink },
  invoice: { borderLeftWidth: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  invoiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#f8fafc' },
  hint: { textAlign: 'center', fontSize: 11, color: COLORS.inkFaint },
});
