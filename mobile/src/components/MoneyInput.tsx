import React from 'react';
import { TextInput } from 'react-native-paper';
import { centsTextToNumber, numberToMoneyText } from '../utils/format';

/** Campo de valor em reais: digitar "1234" mostra "12,34". */
export function MoneyInput({ label, value, onChange, error }: { label: string; value: number; onChange: (v: number) => void; error?: boolean }) {
  return (
    <TextInput
      mode="outlined"
      label={label}
      value={value ? numberToMoneyText(value) : ''}
      onChangeText={(t) => onChange(centsTextToNumber(t))}
      keyboardType="number-pad"
      left={<TextInput.Affix text="R$" />}
      error={error}
      placeholder="0,00"
    />
  );
}
