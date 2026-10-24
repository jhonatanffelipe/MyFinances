import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import { FormScreen } from '../components/FormScreen';
import { PickerField } from '../components/PickerField';
import { MonthSelector } from '../components/MonthSelector';
import { confirm } from '../components/confirm';
import { defaultYearMonth, yearMonthLabel } from '../data/date';
import { BulkDeletePreview, bulkDeleteCard, previewBulkDeleteCard } from '../data/repositories/movements';
import { listCreditCards } from '../data/repositories/creditCards';
import { CreditCard } from '../data/types';
import { formatCurrency } from '../utils/format';
import { COLORS } from '../theme/tokens';

/** Exclui de uma vez todos os lançamentos de um cartão em um mês (igual ao desktop). */
export default function BulkDelete() {
  const params = useLocalSearchParams<{ cardId?: string; yearMonth?: string }>();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cardId, setCardId] = useState<number | null>(params.cardId ? Number(params.cardId) : null);
  const [yearMonth, setYearMonth] = useState(params.yearMonth && /^\d{4}-\d{2}$/.test(params.yearMonth) ? params.yearMonth : defaultYearMonth());
  const [preview, setPreview] = useState<BulkDeletePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCreditCards().then((list) => {
      setCards(list);
      if (!cardId && list[0]) setCardId(list[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cardId) return setPreview(null);
    let cancelled = false;
    setLoading(true);
    previewBulkDeleteCard(cardId, yearMonth)
      .then((p) => !cancelled && setPreview(p))
      .catch((err) => !cancelled && setError(err?.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cardId, yearMonth]);

  const card = cards.find((c) => c.id === cardId);

  const run = async () => {
    if (!cardId || !preview?.count) return;
    if (!(await confirm('Confirmar exclusão', `Excluir ${preview.count} lançamento(s) de ${card?.description} em ${yearMonthLabel(yearMonth)}? Não é possível desfazer.`))) return;
    setSaving(true);
    try {
      await bulkDeleteCard(cardId, yearMonth);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen error={error} saving={saving} onSave={run} saveLabel={preview?.count ? `Excluir ${preview.count} lançamento(s)` : 'Excluir'}>
      <PickerField label="Cartão" value={cardId} onChange={setCardId} options={cards.map((c) => ({ value: c.id, label: c.description, color: c.color }))} />
      <MonthSelector value={yearMonth} onChange={setYearMonth} />
      <View style={styles.preview}>
        {loading ? (
          <ActivityIndicator color={COLORS.brand} />
        ) : preview && preview.count > 0 ? (
          <>
            <Text style={styles.strong}>
              {preview.count} lançamento(s) de {card?.description} em {yearMonthLabel(yearMonth)}
            </Text>
            <Text style={styles.text}>
              Saídas: {formatCurrency(preview.totalExpense)}
              {preview.totalIncome > 0 ? ` · Entradas: ${formatCurrency(preview.totalIncome)}` : ''}
            </Text>
            {preview.fixedCount > 0 ? <Text style={{ color: '#b45309' }}>Inclui {preview.fixedCount} gerado(s) por despesas fixas.</Text> : null}
          </>
        ) : (
          <Text style={styles.text}>Nenhum lançamento deste cartão no mês.</Text>
        )}
      </View>
      {preview && preview.count > 0 ? (
        <View style={styles.warn}>
          <Icon source="alert-outline" size={18} color={COLORS.danger} />
          <Text style={{ color: COLORS.danger, flex: 1 }}>Esta ação não pode ser desfeita.</Text>
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  preview: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, padding: 14, gap: 4, minHeight: 70, justifyContent: 'center' },
  strong: { fontWeight: '800', color: COLORS.ink },
  text: { color: COLORS.inkMuted },
  warn: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: COLORS.dangerSoft, borderRadius: 12, padding: 10 },
});
