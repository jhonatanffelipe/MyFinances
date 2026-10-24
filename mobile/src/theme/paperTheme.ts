import { MD3LightTheme, MD3Theme } from 'react-native-paper';
import { COLORS } from './tokens';

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.brand,
    onPrimary: '#ffffff',
    primaryContainer: COLORS.brandSoft,
    onPrimaryContainer: '#064e3b',
    secondary: COLORS.inkSoft,
    secondaryContainer: '#e2e8f0',
    onSecondaryContainer: COLORS.ink,
    background: COLORS.canvas,
    surface: COLORS.surface,
    surfaceVariant: '#f1f5f9',
    onSurface: COLORS.ink,
    onSurfaceVariant: COLORS.inkMuted,
    outline: COLORS.line,
    outlineVariant: '#f1f5f9',
    error: COLORS.danger,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#ffffff',
      level3: '#f8fafc',
    },
  },
};
