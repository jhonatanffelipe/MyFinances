import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Button, Checkbox, HelperText, SegmentedButtons, Text } from 'react-native-paper';
import { PickerField } from '../components/PickerField';
import { Badge } from '../components/Badge';
import { DateField } from '../components/DateField';
import type { Category, CreditCard, ImportAnalysis, ImportBankType } from '@myfinances/core';
import { appSession } from '../engine/session';
import { formatCurrency, isoToBr } from '../utils/format';
import { COLORS } from '../theme/tokens';

/** Importa fatura CSV do Nubank ou do Banco Inter (mesma lógica do desktop). */
export default function ImportScreen() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cardId, setCardId] = useState<string | null>(null);
  const [bank, setBank] = useState<ImportBankType>('AUTO');
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const core = appSession.core();
    core.creditCards.list.execute({ onlyActive: true, perPage: 9999 }).then((r) => setCards(r.data));
    core.categories.list.execute({ perPage: 9999 }).then((r) => setCategories(r.data));
  }, []);

  useEffect(() => {
    if (!file) return;
    setBusy(true);
    appSession
      .core()
      .movements.analyzeImport.execute(file.content, { fileName: file.name, creditCardId: cardId, bankType: bank })
      .then(setAnalysis)
      .catch((err) => setError(err?.message || 'Não foi possível ler o arquivo'))
      .finally(() => setBusy(false));
  }, [file, cardId, bank]);

  const pick = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    try {
      const content = await new File(asset.uri).text();
      setFile({ name: asset.name, content });
    } catch (err: any) {
      setError(err?.message || 'Falha ao ler o arquivo');
    }
  };

  const toggle = (id: string) =>
    setAnalysis((a) => (a ? { ...a, items: a.items.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)) } : a));

  const setAllDates = (date: string | null) =>
    setAnalysis((a) => (a && date ? { ...a, invoiceDate: date, items: a.items.map((i) => ({ ...i, originalDate: i.originalDate || i.date, date })) } : a));

  const selected = analysis?.items.filter((i) => i.selected) || [];
  const selectedTotal = selected.reduce((s, i) => s + (i.type === 'EXPENSE' ? i.amount : -i.amount), 0);

  const run = async () => {
    if (!analysis) return;
    setBusy(true);
    try {
      await appSession.core().movements.executeImport.execute(analysis.items, cardId);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Erro ao importar');
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <PickerField
        label="Cartão da fatura"
        value={cardId}
        onChange={setCardId}
        allowEmpty
        emptyLabel="Sem cartão (extrato)"
        options={cards.map((c) => ({ value: c.id, label: c.description, color: c.color ?? undefined }))}
      />
      <SegmentedButtons
        value={bank}
        onValueChange={(v) => setBank(v as ImportBankType)}
        buttons={[
          { value: 'AUTO', label: 'Detectar' },
          { value: 'NUBANK', label: 'Nubank' },
          { value: 'INTER', label: 'Inter' },
        ]}
      />
      <Button mode="outlined" icon="file-upload-outline" onPress={pick}>
        {file ? `Arquivo: ${file.name}` : 'Escolher arquivo CSV'}
      </Button>
      {analysis ? (
        <>
          {analysis.invoiceDate ? <DateField label="Data dos lançamentos (vencimento)" value={analysis.invoiceDate} onChange={setAllDates} /> : null}
          <Text style={styles.stats}>
            {analysis.totalCount} itens · {analysis.duplicateCount} possível(is) duplicado(s) · {analysis.invoicePaymentCount} pagamento(s) de fatura
          </Text>
        </>
      ) : null}
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={analysis?.items || []}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => {
          const cat = categories.find((c) => c.id === item.categoryId);
          return (
            <Pressable onPress={() => toggle(item.id)} style={[styles.row, !item.selected && { opacity: 0.55 }]}>
              <Checkbox.Android status={item.selected ? 'checked' : 'unchecked'} color={COLORS.brand} onPress={() => toggle(item.id)} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.desc} numberOfLines={1}>
                  {item.description}
                </Text>
                <View style={styles.meta}>
                  <Text style={styles.small}>{isoToBr(item.originalDate || item.date)}</Text>
                  {cat ? <Badge label={cat.name} color={cat.color ?? undefined} /> : <Badge label="Sem categoria" />}
                  {item.isInvoicePayment ? <Badge label="Pagamento de fatura" color={COLORS.blue} /> : null}
                </View>
                {item.potentialDuplicate.isDuplicate ? <Text style={styles.dup}>{item.potentialDuplicate.reason}</Text> : null}
              </View>
              <Text style={[styles.amount, item.type === 'INCOME' && { color: COLORS.brandDark }]}>
                {item.type === 'INCOME' ? '+' : '-'} {formatCurrency(item.amount)}
              </Text>
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        <Text style={styles.small}>
          {selected.length} selecionado(s) · {formatCurrency(selectedTotal)}
        </Text>
        <Button mode="contained" onPress={run} loading={busy} disabled={busy || selected.length === 0}>
          Importar {selected.length || ''}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  header: { padding: 16, gap: 12 },
  stats: { color: COLORS.inkMuted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 14, paddingVertical: 8, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  desc: { fontWeight: '700', color: COLORS.ink },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  small: { fontSize: 11, color: COLORS.inkMuted },
  dup: { fontSize: 11, color: '#b45309' },
  amount: { fontWeight: '800', color: COLORS.ink },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: COLORS.surface },
});
