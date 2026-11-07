import React from 'react';
import { Image, View } from 'react-native';
import { Text } from 'react-native-paper';
import { initials } from '../utils/format';
import { COLORS } from '../theme/tokens';

/** Foto do membro ou as iniciais do nome. */
export function MemberAvatar({ name, avatarUrl, size = 28 }: { name?: string | null; avatarUrl?: string | null; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (avatarUrl) return <Image source={{ uri: avatarUrl }} style={style} />;
  return (
    <View style={[style, { backgroundColor: COLORS.brandDark, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: Math.max(9, Math.round(size * 0.38)) }}>{initials(name)}</Text>
    </View>
  );
}
