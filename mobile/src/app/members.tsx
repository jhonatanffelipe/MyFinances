import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Screen } from '../components/Screen';
import { MemberAvatar } from '../components/MemberAvatar';
import { confirm } from '../components/confirm';
import { useAppState, useCanManageFamily } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';
import { COLORS } from '../theme/tokens';

const ROLE_LABEL = { OWNER: 'Dono', ADMIN: 'Administrador', MEMBER: 'Membro' } as const;

/** Membros da família ativa: lista, convidar (código pelo WhatsApp etc.), desativar e reativar. */
export default function Members() {
  const { state, apply, notify } = useAppState();
  const canManage = useCanManageFamily();
  const [busy, setBusy] = useState(false);
  const family = state.families.find((f) => f.id === state.activeFamilyId);
  const members = [...state.members].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  const invite = async () => {
    setBusy(true);
    try {
      const { code } = await appSession.createInvite();
      await Share.share({
        message: `Entre na família ${family?.name ?? ''} no MyFinances: abra o app, toque em "Tenho um código de convite" e cole o código abaixo (vale 7 dias, uma vez).\n\n${code}`,
      });
    } catch (err: any) {
      notify(err?.message ?? 'Não foi possível gerar o convite');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (userId: string, name: string, active: boolean) => {
    const ok = await confirm(
      active ? `Reativar ${name}?` : `Desativar ${name}?`,
      active ? 'A pessoa volta a ver e editar os dados da família.' : 'A pessoa deixa de ver e editar os dados da família. Os lançamentos dela continuam nos totais.',
      active ? 'Reativar' : 'Desativar',
    );
    if (!ok) return;
    try {
      apply(await appSession.setMemberActive(userId, active));
    } catch (err: any) {
      notify(err?.message ?? 'Não foi possível alterar');
    }
  };

  return (
    <Screen>
      <Text style={{ color: COLORS.inkMuted }}>Todos os membros veem e editam os lançamentos da família. O dashboard soma os valores de todos.</Text>
      {canManage ? (
        <Button mode="contained" icon="account-plus-outline" loading={busy} disabled={busy || !state.online} onPress={invite}>
          Convidar alguém
        </Button>
      ) : null}
      {!state.online ? <Text style={{ color: COLORS.inkFaint, fontSize: 12 }}>Convites e mudanças de acesso precisam de internet.</Text> : null}
      <View style={styles.list}>
        {members.map((m) => {
          const isMe = m.user_id === state.user?.id;
          return (
            <View key={m.user_id} style={[styles.row, !m.active && { opacity: 0.55 }]}>
              <MemberAvatar name={m.name} avatarUrl={m.avatar_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {m.name}
                  {isMe ? ' (você)' : ''}
                </Text>
                <Text style={styles.role}>
                  {ROLE_LABEL[m.role]}
                  {!m.active ? ' · desativado' : ''}
                </Text>
              </View>
              {canManage && !isMe && m.role !== 'OWNER' ? (
                <Button compact disabled={!state.online} textColor={m.active ? COLORS.danger : COLORS.brandDark} onPress={() => toggle(m.user_id, m.name, !m.active)}>
                  {m.active ? 'Desativar' : 'Reativar'}
                </Button>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  name: { fontWeight: '700', color: COLORS.ink },
  role: { fontSize: 12, color: COLORS.inkMuted },
});
