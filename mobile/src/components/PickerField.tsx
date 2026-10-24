import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Dialog, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import { COLORS } from '../theme/tokens';

export interface PickerOption<T extends string | number> {
  value: T;
  label: string;
  color?: string;
  group?: string;
}

/** Campo de seleção que abre uma lista em diálogo (funciona bem no Android). */
export function PickerField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecione',
  allowEmpty,
  emptyLabel = 'Nenhum',
  error,
}: {
  label: string;
  value: T | null;
  options: PickerOption<T>[];
  onChange: (v: T | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const list: (PickerOption<T> | { value: null; label: string; color?: string; group?: string })[] = allowEmpty
    ? [{ value: null, label: emptyLabel }, ...options]
    : options;

  return (
    <View>
      <Pressable onPress={() => setOpen(true)}>
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={label}
            value={selected?.label || (value === null && allowEmpty ? emptyLabel : '')}
            placeholder={placeholder}
            editable={false}
            error={error}
            left={selected?.color ? <TextInput.Icon icon="circle" color={selected.color} size={14} /> : undefined}
            right={<TextInput.Icon icon="menu-down" />}
          />
        </View>
      </Pressable>
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)} style={styles.dialog}>
          <Dialog.Title>{label}</Dialog.Title>
          <Dialog.ScrollArea style={styles.scroll}>
            <FlatList
              data={list}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item, index }) => {
                const showGroup = item.group && item.group !== list[index - 1]?.group;
                return (
                  <View>
                    {showGroup ? (
                      <Text variant="labelSmall" style={styles.group}>
                        {item.group}
                      </Text>
                    ) : null}
                    <Pressable
                      style={styles.option}
                      onPress={() => {
                        onChange(item.value as T | null);
                        setOpen(false);
                      }}
                    >
                      <RadioButton.Android
                        value={String(item.value)}
                        status={item.value === value ? 'checked' : 'unchecked'}
                        onPress={() => {
                          onChange(item.value as T | null);
                          setOpen(false);
                        }}
                      />
                      {item.color ? <View style={[styles.dot, { backgroundColor: item.color }]} /> : null}
                      <Text style={styles.optionText}>{item.label}</Text>
                    </Pressable>
                  </View>
                );
              }}
            />
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '80%' },
  scroll: { paddingHorizontal: 0, maxHeight: 460 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 2, gap: 4 },
  optionText: { flex: 1, color: COLORS.ink },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  group: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2, color: COLORS.inkFaint, textTransform: 'uppercase' },
});
