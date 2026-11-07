import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Divider, Icon, Menu, Text } from 'react-native-paper';
import { useAppState } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';
import { COLORS } from '../theme/tokens';

/** Seletor de família no header: trocar, criar outra ou entrar com convite. */
export function FamilyHeader() {
  const { state, apply, notify } = useAppState();
  const [open, setOpen] = useState(false);
  const active = state.families.find((f) => f.id === state.activeFamilyId);

  const select = async (id: string) => {
    setOpen(false);
    if (id === state.activeFamilyId) return;
    try {
      apply(await appSession.selectFamily(id));
    } catch (err: any) {
      notify(err?.message ?? 'Não foi possível trocar de família');
    }
  };

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <Pressable onPress={() => setOpen(true)} style={styles.anchor} hitSlop={8}>
          <Icon source="home-group" size={18} color={COLORS.brandDark} />
          <Text style={styles.name} numberOfLines={1}>
            {active?.name ?? 'Família'}
          </Text>
          <Icon source="chevron-down" size={18} color={COLORS.inkMuted} />
        </Pressable>
      }
    >
      {state.families.map((f) => (
        <Menu.Item key={f.id} leadingIcon={f.id === state.activeFamilyId ? 'check' : undefined} title={f.name} onPress={() => select(f.id)} />
      ))}
      <Divider />
      <Menu.Item
        leadingIcon="account-group-outline"
        title="Membros e convites"
        onPress={() => {
          setOpen(false);
          router.push('/members');
        }}
      />
      <Menu.Item
        leadingIcon="plus"
        title="Criar ou entrar em outra"
        onPress={() => {
          setOpen(false);
          router.push({ pathname: '/family', params: { add: '1' } });
        }}
      />
    </Menu>
  );
}

const styles = StyleSheet.create({
  anchor: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, maxWidth: 200 },
  name: { fontWeight: '700', color: COLORS.ink, flexShrink: 1 },
});
