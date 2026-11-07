import React, { useEffect, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { todayIso, type Category, type CreditCard, type MovementType } from '@myfinances/core';
import { FormScreen } from '../../components/FormScreen';
import { MoneyInput } from '../../components/MoneyInput';
import { DateField } from '../../components/DateField';
import { PickerField } from '../../components/PickerField';
import { confirm } from '../../components/confirm';
import { useAppState } from '../../contexts/AppStateContext';
import { appSession } from '../../engine/session';
import { formatCurrency } from '../../utils/format';
import { COLORS } from '../../theme/tokens';

/** Lançamento: receita, despesa ou transferência entre membros, com "De quem". */
export default function MovementForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { state } = useAppState();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState<string | null>(todayIso());
  const [type, setType] = useState<MovementType>('EXPENSE');
  const [memberId, setMemberId] = useState<string | null>(state.user?.id ?? null);
  const [toMemberId, setToMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTransfer = type === 'TRANSFER';

  useEffect(() => {
    (async () => {
      const core = appSession.core();
      setCategories((await core.categories.list.execute({ perPage: 9999 })).data);
      setCards((await core.creditCards.list.execute({ perPage: 9999 })).data);
      if (!isNew) {
        const m = await core.movements.get.execute(id);
        setDescription(m.description);
        setAmount(Number(m.amount));
        setDate(m.date);
        setType(m.type);
        setMemberId(m.member_id ?? null);
        setMemberName(m.member_name ?? null);
        setToMemberId(m.to_member_id ?? null);
        setCategoryId(m.category_id || null);
        setCardId(m.credit_card_id || null);
        setNotes(m.notes || '');
      }
    })().catch((err) => setError(err?.message));
  }, [id, isNew]);

  // Membros ativos; mantém o atual mesmo se tiver sido desativado (lançamento antigo continua editável)
  const memberOptions = (exclude?: string | null) =>
    state.members
      .filter((m) => (m.active || m.user_id === memberId || m.user_id === toMemberId) && m.user_id !== exclude)
      .map((m) => ({ value: m.user_id, label: m.user_id === state.user?.id ? `${m.name} (você)` : m.name }));

  const save = async () => {
    if (!description.trim()) return setError('Informe a descrição');
    if (!amount) return setError('Informe o valor');
    if (!date) return setError('Informe a data');
    if (isTransfer && !toMemberId) return setError('Informe quem recebe');
    if (!isTransfer && !categoryId) return setError('Escolha a categoria');
    setSaving(true);
    setError(null);
    try {
      const input = {
        description: description.trim(),
        amount,
        date,
        type,
        member_id: memberId,
        to_member_id: isTransfer ? toMemberId : null,
        category_id: isTransfer ? null : categoryId,
        credit_card_id: isTransfer ? null : cardId,
        notes,
      };
      const core = appSession.core();
      if (isNew) await core.movements.create.execute(input);
      else await core.movements.update.execute(id, input);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const owner = memberName ?? 'membro desconhecido';
    if (await confirm('Excluir movimentação', `Excluir "${description}" (${formatCurrency(amount)}) de ${owner}? Some para todos os membros da família.`)) {
      try {
        await appSession.core().movements.remove.execute(id);
        router.back();
      } catch (err: any) {
        setError(err?.message || 'Erro ao excluir');
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Nova transação' : 'Editar movimentação' }} />
      <FormScreen error={error} saving={saving} onSave={save} onDelete={isNew ? undefined : remove} saveLabel={isNew ? 'Salvar transação' : 'Atualizar'}>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => {
            setType(v as MovementType);
            setCategoryId(null);
            if (v === 'TRANSFER') setCardId(null);
            else setToMemberId(null);
          }}
          buttons={[
            { value: 'EXPENSE', label: 'Despesa', icon: 'arrow-up-circle-outline' },
            { value: 'INCOME', label: 'Receita', icon: 'arrow-down-circle-outline' },
            ...(state.members.length > 1 ? [{ value: 'TRANSFER', label: 'Transf.', icon: 'swap-horizontal' }] : []),
          ]}
        />
        <PickerField label={isTransfer ? 'De' : 'De quem'} value={memberId} onChange={setMemberId} options={memberOptions()} />
        {isTransfer ? <PickerField label="Para" value={toMemberId} onChange={setToMemberId} options={memberOptions(memberId)} /> : null}
        <TextInput mode="outlined" label="Descrição" value={description} onChangeText={setDescription} />
        <MoneyInput label="Valor" value={amount} onChange={setAmount} />
        <DateField label="Data" value={date} onChange={setDate} />
        {isTransfer ? (
          <Text style={{ color: COLORS.inkMuted, fontSize: 12 }}>
            Transferência (mesada, repasse) não entra nos totais da família: sai de quem envia e entra para quem recebe.
          </Text>
        ) : (
          <>
            <PickerField
              label="Categoria"
              value={categoryId}
              onChange={setCategoryId}
              options={categories.filter((c) => c.type === type).map((c) => ({ value: c.id, label: c.name, color: c.color ?? undefined }))}
            />
            <PickerField
              label="Cartão de crédito"
              value={cardId}
              onChange={setCardId}
              allowEmpty
              emptyLabel="Sem cartão (dinheiro/débito)"
              options={cards.map((c) => ({ value: c.id, label: c.description, color: c.color ?? undefined }))}
            />
          </>
        )}
        <TextInput mode="outlined" label="Anotações" value={notes} onChangeText={setNotes} multiline />
      </FormScreen>
    </>
  );
}
