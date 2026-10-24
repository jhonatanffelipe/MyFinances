import React, { forwardRef } from 'react';
import { InputAdornment, TextField, TextFieldProps } from '@mui/material';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { IMaskInput } from 'react-imask';

interface MaskAdapterProps {
  onChange: (event: { target: { name: string; value: string } }) => void;
  name: string;
}

/**
 * Máscara de moeda (pt-BR, 2 casas decimais).
 * Emite o valor sem formatação monetária (ex: "79.90").
 */
const MoneyMaskAdapter = forwardRef<HTMLInputElement, MaskAdapterProps>(function MoneyMaskAdapter(props, ref) {
  const { onChange, name, ...other } = props;

  return (
    <IMaskInput
      {...other}
      name={name}
      inputRef={ref}
      mask={Number}
      scale={2}
      thousandsSeparator="."
      radix=","
      mapToRadix={['.']}
      padFractionalZeros
      normalizeZeros
      min={0}
      unmask
      onAccept={(value: string) => onChange({ target: { name, value: value ?? '' } })}
    />
  );
});

/**
 * Máscara de dia do mês (1 a 31).
 */
const DayMaskAdapter = forwardRef<HTMLInputElement, MaskAdapterProps>(function DayMaskAdapter(props, ref) {
  const { onChange, name, ...other } = props;

  return (
    <IMaskInput
      {...other}
      name={name}
      inputRef={ref}
      mask={Number}
      scale={0}
      min={1}
      max={31}
      unmask
      onAccept={(value: string) => onChange({ target: { name, value: value ?? '' } })}
    />
  );
});

/**
 * Máscara de número inteiro positivo (com separador de milhar).
 */
const IntegerMaskAdapter = forwardRef<HTMLInputElement, MaskAdapterProps>(function IntegerMaskAdapter(props, ref) {
  const { onChange, name, ...other } = props;

  return (
    <IMaskInput
      {...other}
      name={name}
      inputRef={ref}
      mask={Number}
      scale={0}
      thousandsSeparator="."
      min={0}
      unmask
      onAccept={(value: string) => onChange({ target: { name, value: value ?? '' } })}
    />
  );
});

export interface MaskedNumberFieldProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues, any>;
  name: Path<TFieldValues>;
  label?: string;
  variant?: 'money' | 'day' | 'integer';
  disabled?: boolean;
  helperText?: string;
  placeholder?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  className?: string;
  slotProps?: TextFieldProps['slotProps'];
}

/**
 * Campo numérico com máscara (react-imask) integrado ao react-hook-form e MUI.
 * - variant="money": prefixo R$, formato 0,00, separador de milhar '.'
 * - variant="day": número de 1 a 31 (para dias de vencimento)
 * - variant="integer": número inteiro positivo
 */
export function MaskedNumberField<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  variant = 'money',
  disabled,
  helperText,
  placeholder,
  size = 'small',
  fullWidth = true,
  className,
}: MaskedNumberFieldProps<TFieldValues>) {
  const Adapter =
    variant === 'money' ? MoneyMaskAdapter : variant === 'day' ? DayMaskAdapter : IntegerMaskAdapter;

  const startAdornment =
    variant === 'money' ? <InputAdornment position="start">R$</InputAdornment> : undefined;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          fullWidth={fullWidth}
          size={size}
          label={label}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          name={field.name}
          value={field.value === null || field.value === undefined ? '' : String(field.value)}
          onChange={(event) => {
            const val = event.target.value;
            field.onChange(val === '' ? '' : Number(val));
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={!!fieldState.error}
          helperText={fieldState.error?.message || helperText}
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              inputComponent: Adapter as any,
              startAdornment,
            },
          }}
        />
      )}
    />
  );
}
