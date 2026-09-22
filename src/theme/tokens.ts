/**
 * Tokens de design extraídos do arquivo Figma "MyFinances".
 * Fonte única de verdade para cores usadas fora do Tailwind
 * (gráficos MUI X, seletores de cor, badges dinâmicos).
 */
export const COLORS = {
  brand: '#10b981',
  brandDark: '#059669',
  brandSoft: 'rgba(16, 185, 129, 0.08)',
  ink: '#0f172a',
  inkSoft: '#1e293b',
  inkMuted: '#475569',
  inkFaint: '#94a3b8',
  line: '#e2e8f0',
  canvas: '#f8fafc',
  surface: '#ffffff',
  danger: '#ef4444',
  dangerSoft: 'rgba(239, 68, 68, 0.08)',
  blue: '#3b82f6',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  pink: '#ec4899',
} as const;

/** Sequência de cores usada em gráficos e na paleta rápida dos cadastros. */
export const CHART_PALETTE = [
  COLORS.inkSoft,
  COLORS.brand,
  COLORS.blue,
  COLORS.amber,
  COLORS.pink,
  COLORS.violet,
  COLORS.inkFaint,
  COLORS.danger,
];

export const RADIUS = {
  card: 16,
  control: 10,
} as const;

export const CARD_SHADOW = '0 4px 8px rgba(0, 0, 0, 0.04)';
