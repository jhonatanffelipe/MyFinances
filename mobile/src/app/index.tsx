import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAppState } from '../contexts/AppStateContext';
import { COLORS } from '../theme/tokens';

/** Decide a tela pela fase: conectar → login → família → app. */
export default function Gate() {
  const { state } = useAppState();
  switch (state.phase) {
    case 'connect':
      return <Redirect href="/connect" />;
    case 'login':
      return <Redirect href="/login" />;
    case 'family':
      return <Redirect href="/family" />;
    case 'ready':
      return <Redirect href="/(tabs)" />;
    default:
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas }}>
          <ActivityIndicator color={COLORS.brand} size="large" />
        </View>
      );
  }
}
