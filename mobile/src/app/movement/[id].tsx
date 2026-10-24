import React, { useEffect, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SegmentedButtons, TextInput } from 'react-native-paper';
import { FormScreen } from '../../components/FormScreen';
import { MoneyInput } from '../../components/MoneyInput';
import { DateField } from '../../components/DateField';
import { PickerField } from '../../components/PickerField';
import { confirm } from '../../components/confirm';
import { todayIso } from '../../data/date';
import { createMovement, deleteMovement, getMovement, updateMovement } from '../../data/repositories/movements';
import { listCategories } from '../../data/repositories/categories';
import { listCreditCards } from '../../data/repositories/creditCards';
import { Category, CreditCard, TransactionType } from '../../data/types';

export default function MovementForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState<string | null>(todayIso());
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setCategories(await listCategories());
      setCards(await listCreditCards());
      if (!isNew) {
        const m = await getMovement(Number(id));
        if (m) {
          setDescription(m.description);
          setAmount(Number(m.amount));
          setDate(m.date);
          setType(m.type);
          setCategoryId(m.category_id || null);
          setCardId(m.credit_card_id || null);
          setNotes(m.notes || '');
        }
      }
    })().catch((err) => setError(err?.message));
  }, [id, isNew]);

  const save = async () => {
    if (!description.trim()) return setError('Informe a descrição');
    if (!amount) return setError('Informe o valor');
    if (!date) return setError('Informe a data');
    if (!categoryId) return setError('Escolha a categoria');
    setSaving(true);
    setError(null);
    try {
      const input = { description: description.trim(), amount, date, type, category_id: categoryId, credit_card_id: cardId, notes };
      if (isNew) await createMovement(input);
      else await updateMovement(Number(id), input);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (await confirm('Excluir movimentação', `Excluir "${description}"?`)) {
      await deleteMovement(Number(id));
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Nova transação' : 'Editar movimentação' }} />
      <FormScreen error={error} saving={saving} onSave={save} onDelete={isNew ? undefined : remove} saveLabel={isNew ? 'Salvar transação' : 'Atualizar'}>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => {
            setType(v as TransactionType);
            setCategoryId(null);
          }}
          buttons={[
            { value: 'EXPENSE', label: 'Despesa', icon: 'arrow-up-circle-outline' },
            { value: 'INCOME', label: 'Receita', icon: 'arrow-down-circle-outline' },
          ]}
        />
        <TextInput mode="outlined" label="Descrição" value={description} onChangeText={setDescription} />
        <MoneyInput label="Valor" value={amount} onChange={setAmount} />
        <DateField label="Data" value={date} onChange={setDate} />
        <PickerField
          label="Categoria"
          value={categoryId}
          onChange={setCategoryId}
          options={categories.filter((c) => c.type === type).map((c) => ({ value: c.id, label: c.name, color: c.color }))}
        />
        <PickerField
          label="Cartão de crédito"
          value={cardId}
          onChange={setCardId}
          allowEmpty
          emptyLabel="Sem cartão (dinheiro/débito)"
          options={cards.map((c) => ({ value: c.id, label: c.description, color: c.color }))}
        />
        <TextInput mode="outlined" label="Anotações" value={notes} onChangeText={setNotes} multiline />
      </FormScreen>
    </>
  );
}
