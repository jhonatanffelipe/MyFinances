import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Switch, Text, TextInput } from 'react-native-paper';
import { FormScreen } from '../../components/FormScreen';
import { ColorPicker } from '../../components/ColorPicker';
import { confirm } from '../../components/confirm';
import { createCreditCard, deleteCreditCard, getCreditCard, updateCreditCard } from '../../data/repositories/creditCards';
import { COLORS } from '../../theme/tokens';

export default function CardForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [description, setDescription] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [color, setColor] = useState('#8b5cf6');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    getCreditCard(Number(id)).then((c) => {
      if (!c) return;
      setDescription(c.description);
      setDueDay(String(c.due_day));
      setColor(c.color || '#8b5cf6');
      setActive(Boolean(c.active));
    });
  }, [id, isNew]);

  const save = async () => {
    const day = parseInt(dueDay, 10);
    if (!description.trim()) return setError('Informe o nome do cartão');
    if (!day || day < 1 || day > 31) return setError('Dia de vencimento deve ser entre 1 e 31');
    setSaving(true);
    try {
      const input = { description: description.trim(), due_day: day, color, active: active ? 1 : 0 };
      if (isNew) await createCreditCard(input);
      else await updateCreditCard(Number(id), input);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (await confirm('Excluir cartão', `Excluir "${description}"? Os lançamentos continuam, mas ficam sem cartão.`)) {
      await deleteCreditCard(Number(id));
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Novo cartão' : 'Editar cartão' }} />
      <FormScreen error={error} saving={saving} onSave={save} onDelete={isNew ? undefined : remove}>
        <TextInput mode="outlined" label="Nome do cartão" value={description} onChangeText={setDescription} />
        <TextInput mode="outlined" label="Dia do vencimento" value={dueDay} onChangeText={(t) => setDueDay(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
        <ColorPicker value={color} onChange={setColor} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: COLORS.ink }}>Ativo</Text>
          <Switch value={active} onValueChange={setActive} color={COLORS.brand} />
        </View>
      </FormScreen>
    </>
  );
}
