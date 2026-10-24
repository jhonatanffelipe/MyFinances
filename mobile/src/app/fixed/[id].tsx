import React, { useEffect, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Switch, Text, TextInput } from 'react-native-paper';
import { View } from 'react-native';
import { FormScreen } from '../../components/FormScreen';
import { MoneyInput } from '../../components/MoneyInput';
import { DateField } from '../../components/DateField';
import { PickerField } from '../../components/PickerField';
import { confirm } from '../../components/confirm';
import { todayIso } from '../../data/date';
import { RECURRENCE_LABEL, createFixedEntry, deleteFixedEntry, getFixedEntry, updateFixedEntry } from '../../data/repositories/fixedEntries';
import { listCategories } from '../../data/repositories/categories';
import { listCreditCards } from '../../data/repositories/creditCards';
import { Category, CreditCard, FixedExpenseRecurrence, TransactionType } from '../../data/types';
import { COLORS } from '../../theme/tokens';

export default function FixedForm() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const isNew = params.id === 'new';
  const [type, setType] = useState<TransactionType>(params.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [dueDay, setDueDay] = useState('10');
  const [recurrence, setRecurrence] = useState<FixedExpenseRecurrence>('MONTHLY');
  const [startDate, setStartDate] = useState<string | null>(todayIso());
  const [endDate, setEndDate] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isIncome = type === 'INCOME';

  useEffect(() => {
    (async () => {
      setCategories(await listCategories());
      setCards(await listCreditCards());
      if (!isNew) {
        const f = await getFixedEntry(Number(params.id));
        if (f) {
          setType(f.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
          setDescription(f.description);
          setAmount(Number(f.amount));
          setDueDay(String(f.due_day));
          setRecurrence(f.recurrence || 'MONTHLY');
          setStartDate(f.start_date);
          setEndDate(f.end_date || null);
          setCategoryId(f.category_id || null);
          setCardId(f.credit_card_id || null);
          setActive(Boolean(f.active));
          setNotes(f.notes || '');
        }
      }
    })().catch((err) => setError(err?.message));
  }, [params.id, isNew]);

  const save = async () => {
    const day = parseInt(dueDay, 10);
    if (!description.trim()) return setError('Informe a descrição');
    if (!amount) return setError('Informe o valor');
    if (!day || day < 1 || day > 31) return setError('Dia de vencimento deve ser entre 1 e 31');
    if (!startDate) return setError('Informe a data de início');
    if (endDate && endDate < startDate) return setError('A data final deve ser posterior ao início');
    if (!categoryId) return setError('Escolha a categoria');
    setSaving(true);
    setError(null);
    try {
      const input = {
        description: description.trim(), amount, type, category_id: categoryId, credit_card_id: isIncome ? null : cardId,
        recurrence, due_day: day, start_date: startDate, end_date: endDate, active: active ? 1 : 0, notes,
      };
      if (isNew) await createFixedEntry(input);
      else await updateFixedEntry(Number(params.id), input);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (await confirm('Excluir lançamento fixo', `Excluir "${description}" e os movimentos gerados por ele?`)) {
      await deleteFixedEntry(Number(params.id));
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: `${isNew ? 'Nova' : 'Editar'} ${isIncome ? 'receita fixa' : 'despesa fixa'}` }} />
      <FormScreen error={error} saving={saving} onSave={save} onDelete={isNew ? undefined : remove}>
        <TextInput mode="outlined" label="Descrição" value={description} onChangeText={setDescription} />
        <MoneyInput label="Valor" value={amount} onChange={setAmount} />
        <TextInput mode="outlined" label="Dia do vencimento" value={dueDay} onChangeText={(t) => setDueDay(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
        <PickerField
          label="Recorrência"
          value={recurrence}
          onChange={(v) => setRecurrence((v as FixedExpenseRecurrence) || 'MONTHLY')}
          options={(Object.keys(RECURRENCE_LABEL) as FixedExpenseRecurrence[]).map((k) => ({ value: k, label: RECURRENCE_LABEL[k] }))}
        />
        <DateField label="Início" value={startDate} onChange={setStartDate} />
        <DateField label="Fim (opcional — gera os movimentos do período)" value={endDate} onChange={setEndDate} clearable />
        <PickerField
          label="Categoria"
          value={categoryId}
          onChange={setCategoryId}
          options={categories.filter((c) => c.type === type).map((c) => ({ value: c.id, label: c.name, color: c.color }))}
        />
        {!isIncome ? (
          <PickerField
            label="Cartão de crédito"
            value={cardId}
            onChange={setCardId}
            allowEmpty
            emptyLabel="Sem cartão"
            options={cards.map((c) => ({ value: c.id, label: c.description, color: c.color }))}
          />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: COLORS.ink }}>Ativo</Text>
          <Switch value={active} onValueChange={setActive} color={COLORS.brand} />
        </View>
        <TextInput mode="outlined" label="Anotações" value={notes} onChangeText={setNotes} multiline />
      </FormScreen>
    </>
  );
}
