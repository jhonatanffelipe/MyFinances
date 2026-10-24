import React, { useEffect, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SegmentedButtons, TextInput } from 'react-native-paper';
import { FormScreen } from '../../components/FormScreen';
import { MoneyInput } from '../../components/MoneyInput';
import { ColorPicker } from '../../components/ColorPicker';
import { confirm } from '../../components/confirm';
import { createCategory, deleteCategory, getCategory, updateCategory } from '../../data/repositories/categories';
import { TransactionType } from '../../data/types';

export default function CategoryForm() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const isNew = params.id === 'new';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>(params.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
  const [color, setColor] = useState('#10b981');
  const [icon, setIcon] = useState('Tag');
  const [limit, setLimit] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    getCategory(Number(params.id)).then((c) => {
      if (!c) return;
      setName(c.name);
      setDescription(c.description || '');
      setType(c.type);
      setColor(c.color || '#94a3b8');
      setIcon(c.icon || 'Tag');
      setLimit(Number(c.monthly_limit || 0));
    });
  }, [params.id, isNew]);

  const save = async () => {
    if (!name.trim()) return setError('Informe o nome');
    setSaving(true);
    try {
      const input = { name: name.trim(), description, type, color, icon, monthly_limit: limit || null };
      if (isNew) await createCategory(input);
      else await updateCategory(Number(params.id), input);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (await confirm('Excluir categoria', `Excluir "${name}"? Os lançamentos ficarão sem categoria.`)) {
      await deleteCategory(Number(params.id));
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Nova categoria' : 'Editar categoria' }} />
      <FormScreen error={error} saving={saving} onSave={save} onDelete={isNew ? undefined : remove}>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as TransactionType)}
          buttons={[
            { value: 'EXPENSE', label: 'Despesa' },
            { value: 'INCOME', label: 'Receita' },
          ]}
        />
        <TextInput mode="outlined" label="Nome" value={name} onChangeText={setName} />
        <TextInput mode="outlined" label="Descrição" value={description} onChangeText={setDescription} />
        <MoneyInput label="Limite mensal (opcional)" value={limit} onChange={setLimit} />
        <ColorPicker value={color} onChange={setColor} />
      </FormScreen>
    </>
  );
}
