import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { noSelect, radius, space, tabular, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** A surface panel. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="label" tone="muted" style={styles.sectionTitleText}>
        {children}
      </AppText>
      {right}
    </View>
  );
}

interface SegmentedProps<T extends string | number> {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string | number>({ options, value, onChange, label }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: theme.accent },
              pressed && !selected && { opacity: 0.6 },
            ]}>
            <AppText
              numberOfLines={1}
              style={[styles.segmentLabel, { color: selected ? theme.onAccent : theme.textDim }]}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  /** Text shown instead of the bare number. */
  format?: (value: number) => string;
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label, format }: StepperProps) {
  const theme = useTheme();
  const change = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));
  const button = (icon: IconName, delta: number, disabled: boolean, name: string) => (
    <Pressable
      onPress={() => change(delta)}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label}`}
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
        pressed && { opacity: 0.6 },
        disabled && { opacity: 0.3 },
      ]}>
      <Icon name={icon} size={20} color={theme.text} />
    </Pressable>
  );
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${value}`}>
      {button('minus', -step, value <= min, 'Decrease')}
      <AppText style={[styles.stepValue, tabular]}>{format ? format(value) : value}</AppText>
      {button('plus', step, value >= max, 'Increase')}
    </View>
  );
}

interface SwitchRowProps {
  title: string;
  description?: string;
  icon?: IconName;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function SwitchRow({ title, description, icon, value, onChange }: SwitchRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      style={styles.row}>
      {icon ? <Icon name={icon} size={22} color={theme.textDim} /> : null}
      <View style={styles.rowText}>
        <AppText variant="strong">{title}</AppText>
        {description ? (
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.borderStrong, true: theme.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={theme.borderStrong}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

interface ListRowProps {
  title: string;
  description?: string;
  icon?: IconName;
  /** Custom element at the left instead of an icon. */
  left?: ReactNode;
  /** Value or control at the right. */
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  testID?: string;
}

/** A tappable row for menus and lists. */
export function ListRow({ title, description, icon, left, right, onPress, destructive, showChevron, testID }: ListRowProps) {
  const theme = useTheme();
  const color = destructive ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      {left ?? (icon ? <Icon name={icon} size={22} color={destructive ? theme.danger : theme.textDim} /> : null)}
      <View style={styles.rowText}>
        <AppText variant="strong" style={{ color }} numberOfLines={1}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
      </View>
      {right}
      {showChevron ? <Icon name="forward" size={18} color={theme.textMuted} /> : null}
    </Pressable>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  testID?: string;
}

/** A small pill used for optional choices. */
export function Chip({ label, selected = false, onPress, icon, disabled, testID }: ChipProps) {
  const theme = useTheme();
  const foreground = selected ? theme.onAccent : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.surfaceRaised,
          borderColor: selected ? theme.accent : theme.border,
        },
        pressed && { opacity: 0.65 },
        disabled && { opacity: 0.35 },
      ]}>
      {icon ? <Icon name={icon} size={15} color={foreground} /> : null}
      <AppText style={[styles.chipLabel, { color: foreground }]} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A circular badge with a player's initial. */
export function Avatar({ name, colour, size = 36 }: { name: string; colour: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colour,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <AppText style={{ color: '#10140F', fontWeight: '800', fontSize: size * 0.44 }} maxFontSizeMultiplier={1}>
        {initial}
      </AppText>
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <Icon name={icon} size={28} color={theme.textDim} />
      </View>
      <AppText variant="heading" center>
        {title}
      </AppText>
      <AppText tone="muted" center>
        {message}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  sectionTitleText: { flex: 1 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm + 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    ...noSelect,
  },
  segmentLabel: { fontSize: 14, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...noSelect,
  },
  stepValue: { minWidth: 44, textAlign: 'center', fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingVertical: space.xs },
  rowText: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    ...noSelect,
  },
  chipLabel: { fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
