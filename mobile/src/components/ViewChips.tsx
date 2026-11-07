import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { useAppState } from '../contexts/AppStateContext';

/** Visão: Família (padrão) | Eu | outros membros. Compartilhada entre Dashboard e Movimentos. */
export function ViewChips() {
  const { state, viewMemberId, setViewMemberId } = useAppState();
  const me = state.user?.id ?? null;
  const others = state.members.filter((m) => m.user_id !== me && (m.active || m.user_id === viewMemberId));
  if (state.members.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip selected={viewMemberId === null} onPress={() => setViewMemberId(null)} icon="home-outline" compact>
        Família
      </Chip>
      {me ? (
        <Chip selected={viewMemberId === me} onPress={() => setViewMemberId(me)} icon="account-outline" compact>
          Eu
        </Chip>
      ) : null}
      {others.map((m) => (
        <Chip key={m.user_id} selected={viewMemberId === m.user_id} onPress={() => setViewMemberId(m.user_id)} compact>
          {m.name.split(' ')[0]}
        </Chip>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8 } });
