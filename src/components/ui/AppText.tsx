import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

const VARIANTS = {
  display: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  strong: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  caption: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof VARIANTS;

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  /** `dim` for secondary text, `muted` for the least important text. */
  tone?: 'default' | 'dim' | 'muted' | 'accent' | 'danger';
  center?: boolean;
}

export function AppText({ variant = 'body', tone = 'default', center, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const color =
    tone === 'dim'
      ? theme.textDim
      : tone === 'muted'
        ? theme.textMuted
        : tone === 'accent'
          ? theme.accent
          : tone === 'danger'
            ? theme.danger
            : theme.text;
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[VARIANTS[variant], { color }, center && { textAlign: 'center' }, style]}
    />
  );
}
