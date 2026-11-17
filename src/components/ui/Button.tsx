import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { noSelect, radius, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  /** Stretch to fill the row it sits in. */
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

const HEIGHT: Record<Size, number> = { lg: 56, md: 48, sm: 38 };
const FONT: Record<Size, number> = { lg: 17, md: 16, sm: 14 };

export function Button({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  icon,
  disabled = false,
  grow = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    secondary: { bg: theme.surfaceRaised, fg: theme.text, border: theme.border },
    danger: { bg: theme.danger, fg: theme.onDanger, border: theme.danger },
    ghost: { bg: 'transparent', fg: theme.textDim, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: HEIGHT[size],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          paddingHorizontal: size === 'sm' ? 12 : 18,
        },
        grow && styles.grow,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <View style={styles.content}>
        {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={palette.fg} /> : null}
        <AppText style={[styles.label, { color: palette.fg, fontSize: FONT[size] }]} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

interface IconButtonProps {
  name: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  disabled?: boolean;
  /** Draw a soft circular background behind the icon. */
  filled?: boolean;
  testID?: string;
}

export function IconButton({ name, onPress, label, size = 22, color, disabled, filled, testID }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.iconButton,
        filled && { backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderWidth: 1 },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Icon name={name} size={size} color={color ?? theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...noSelect,
  },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontWeight: '700' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.38 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...noSelect,
  },
});
