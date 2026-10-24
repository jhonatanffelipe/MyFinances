import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, TextInput } from 'react-native-paper';
import { dateToIso, isoToBr, isoToDate } from '../utils/format';

/** Campo de data (abre o calendário nativo). Valor em YYYY-MM-DD. */
export function DateField({ label, value, onChange, clearable = false }: { label: string; value: string | null; onChange: (v: string | null) => void; clearable?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(true)}>
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={label}
            value={value ? isoToBr(value) : ''}
            editable={false}
            right={<TextInput.Icon icon="calendar" />}
          />
        </View>
      </Pressable>
      {clearable && value ? (
        <Button compact mode="text" onPress={() => onChange(null)} style={{ alignSelf: 'flex-start' }}>
          Remover data
        </Button>
      ) : null}
      {open && (
        <DateTimePicker
          value={value ? isoToDate(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setOpen(Platform.OS === 'ios');
            if (event.type === 'set' && date) onChange(dateToIso(date));
            if (event.type === 'dismissed') setOpen(false);
          }}
        />
      )}
    </View>
  );
}
