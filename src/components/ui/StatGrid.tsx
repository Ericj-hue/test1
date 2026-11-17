import { StyleSheet, View } from 'react-native';

import { radius, space, tabular, useTheme } from '@/theme';

import { AppText } from './AppText';

export interface Stat {
  label: string;
  value: string | number;
  /** Small note under the value. */
  note?: string;
}

/** A grid of headline numbers, three to a row. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}${stat.note ? `, ${stat.note}` : ''}`}
          style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText style={[styles.value, tabular]} numberOfLines={1}>
            {stat.value}
          </AppText>
          <AppText variant="label" tone="muted" style={styles.label} numberOfLines={2}>
            {stat.label}
          </AppText>
          {stat.note ? (
            <AppText variant="caption" tone="dim" numberOfLines={1} style={styles.note}>
              {stat.note}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 78,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  value: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 10, textAlign: 'center' },
  note: { fontSize: 11 },
});
