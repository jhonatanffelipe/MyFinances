import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSync } from '../contexts/SyncContext';
import { useSession } from '../contexts/SessionContext';
import { COLORS } from '../theme/tokens';

/** Decide a tela inicial: conectar OneDrive → escolher arquivo → login → app. */
export default function Gate() {
  const { sync, ready } = useSync();
  const { user, restoring } = useSession();

  if (!ready || (sync.remote && !sync.dbReady && sync.status === 'syncing') || restoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas }}>
        <ActivityIndicator color={COLORS.brand} size="large" />
      </View>
    );
  }
  if (!sync.signedIn && !sync.dbReady) return <Redirect href="/onboarding" />;
  if (!sync.remote || !sync.dbReady) return <Redirect href={sync.signedIn ? '/onboarding/pick' : '/onboarding'} />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
