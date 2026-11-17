import { Platform, type TextStyle } from 'react-native';

import type { BallId } from '@/engine';
import { useApp, type ThemeName } from '@/store';

export interface Theme {
  name: ThemeName;
  /** True when the background is dark (light status-bar icons). */
  dark: boolean;
  bg: string;
  /** Centre, middle and edge colours of the "lit table" backdrop. */
  backdrop: [string, string, string];
  surface: string;
  /** Opaque surface for sheets and dialogs. */
  surfaceSolid: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  danger: string;
  onDanger: string;
  dangerSoft: string;
  success: string;
  scrim: string;
}

const baize: Theme = {
  name: 'baize',
  dark: true,
  bg: '#062A1D',
  backdrop: ['#136046', '#0A3B2A', '#03170F'],
  surface: 'rgba(7, 12, 10, 0.74)',
  surfaceSolid: '#0E1513',
  surfaceRaised: 'rgba(255, 255, 255, 0.07)',
  border: 'rgba(255, 255, 255, 0.11)',
  borderStrong: 'rgba(255, 255, 255, 0.26)',
  text: '#FFFFFF',
  textDim: 'rgba(255, 255, 255, 0.76)',
  textMuted: 'rgba(255, 255, 255, 0.52)',
  accent: '#E9BC55',
  onAccent: '#1B1404',
  accentSoft: 'rgba(233, 188, 85, 0.16)',
  danger: '#EF5158',
  onDanger: '#FFFFFF',
  dangerSoft: 'rgba(239, 81, 88, 0.18)',
  success: '#4CCB85',
  scrim: 'rgba(0, 0, 0, 0.66)',
};

const midnight: Theme = {
  ...baize,
  name: 'midnight',
  bg: '#000000',
  backdrop: ['#101413', '#070909', '#000000'],
  surface: '#121615',
  surfaceSolid: '#141918',
  surfaceRaised: 'rgba(255, 255, 255, 0.08)',
};

const light: Theme = {
  name: 'light',
  dark: false,
  bg: '#E6EEE8',
  backdrop: ['#F7FBF8', '#E6EEE8', '#D3E0D7'],
  surface: '#FFFFFF',
  surfaceSolid: '#FFFFFF',
  surfaceRaised: 'rgba(9, 60, 40, 0.07)',
  border: 'rgba(9, 40, 27, 0.14)',
  borderStrong: 'rgba(9, 40, 27, 0.32)',
  text: '#0B1E16',
  textDim: 'rgba(11, 30, 22, 0.76)',
  textMuted: 'rgba(11, 30, 22, 0.54)',
  accent: '#0A6B47',
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(10, 107, 71, 0.12)',
  danger: '#C8323A',
  onDanger: '#FFFFFF',
  dangerSoft: 'rgba(200, 50, 58, 0.12)',
  success: '#12804F',
  scrim: 'rgba(8, 20, 14, 0.5)',
};

export const THEMES: Record<ThemeName, Theme> = { baize, midnight, light };

export const THEME_LABELS: Record<ThemeName, string> = {
  baize: 'Baize green',
  midnight: 'Dark',
  light: 'Light',
};

export function useTheme(): Theme {
  const name = useApp((state) => state.settings.theme);
  return THEMES[name] ?? baize;
}

export interface BallPaint {
  base: string;
  light: string;
  dark: string;
  /** Colour for a number drawn on the ball. */
  ink: string;
}

export const BALL_PAINT: Record<BallId | 'cue', BallPaint> = {
  red: { base: '#D21F2B', light: '#FF7B74', dark: '#6E0810', ink: '#FFFFFF' },
  yellow: { base: '#F3C614', light: '#FFF3A0', dark: '#A27600', ink: '#3A2A00' },
  green: { base: '#1E9B54', light: '#6BE39B', dark: '#07481F', ink: '#FFFFFF' },
  brown: { base: '#8B4C23', light: '#D0935F', dark: '#3F1E09', ink: '#FFFFFF' },
  blue: { base: '#1F62D6', light: '#7DB0FF', dark: '#092A70', ink: '#FFFFFF' },
  pink: { base: '#F28DB1', light: '#FFDCE8', dark: '#AF4A74', ink: '#4A0F27' },
  black: { base: '#1C1C20', light: '#6A6A76', dark: '#000000', ink: '#FFFFFF' },
  cue: { base: '#F2EFE1', light: '#FFFFFF', dark: '#B7B29C', ink: '#2A2A2A' },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Widest the content column gets on tablets and desktop browsers. */
export const MAX_CONTENT_WIDTH = 560;

/** Digits that do not shift sideways as scores change. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Stops text being selected when buttons are tapped quickly in a browser. */
export const noSelect = Platform.OS === 'web' ? ({ userSelect: 'none' } as const) : {};
