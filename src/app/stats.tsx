import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Avatar, EmptyState, SectionTitle, Segmented } from '@/components/ui/Controls';
import { Screen } from '@/components/ui/Screen';
import { StatGrid } from '@/components/ui/StatGrid';
import { careerStats, winRate, type CareerStats } from '@/engine';
import { useApp } from '@/store';
import { radius, space, tabular, useTheme } from '@/theme';
import { percent } from '@/utils/format';

type SortKey = 'wins' | 'rate' | 'break' | 'frames';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'wins', label: 'Wins' },
  { value: 'rate', label: 'Win %' },
  { value: 'break', label: 'Break' },
  { value: 'frames', label: 'Frames' },
];

function sortValue(stats: CareerStats, key: SortKey): number {
  switch (key) {
    case 'wins':
      return stats.matchesWon;
    case 'rate':
      return winRate(stats);
    case 'break':
      return stats.highestBreak;
    case 'frames':
      return stats.framesWon;
  }
}

function headline(stats: CareerStats, key: SortKey): string {
  switch (key) {
    case 'wins':
      return String(stats.matchesWon);
    case 'rate':
      return percent(winRate(stats));
    case 'break':
      return String(stats.highestBreak);
    case 'frames':
      return String(stats.framesWon);
  }
}

export default function StatsScreen() {
  const theme = useTheme();
  const profiles = useApp((state) => state.profiles);
  const matches = useApp((state) => state.matches);
  const [sort, setSort] = useState<SortKey>('wins');

  const career = careerStats(matches);
  const finished = matches.filter((match) => match.status === 'finished' && match.frames.length > 0);
  const frames = finished.reduce((total, match) => total + match.frames.length, 0);

  const rows = profiles
    .map((profile) => ({ profile, stats: career[profile.id] }))
    .filter((row): row is { profile: (typeof profiles)[number]; stats: CareerStats } => row.stats !== undefined)
    .sort(
      (a, b) =>
        sortValue(b.stats, sort) - sortValue(a.stats, sort) ||
        b.stats.matchesPlayed - a.stats.matchesPlayed ||
        a.profile.name.localeCompare(b.profile.name),
    );

  if (finished.length === 0) {
    return (
      <Screen title="Statistics">
        <EmptyState
          icon="stats"
          title="Nothing to show yet"
          message="Finish a match and its breaks, frames and results are added up here."
          action={<Button label="Start a match" variant="primary" icon="plus" onPress={() => router.push('/new-match')} />}
        />
      </Screen>
    );
  }

  const all = Object.values(career);
  const topBreak = rows.reduce<(typeof rows)[number] | null>(
    (best, row) => (!best || row.stats.highestBreak > best.stats.highestBreak ? row : best),
    null,
  );
  const sum = (pick: (stats: CareerStats) => number) => all.reduce((total, stats) => total + pick(stats), 0);

  return (
    <Screen title="Statistics" subtitle="From every finished match on this device">
      <StatGrid
        stats={[
          { label: 'Matches', value: finished.length },
          { label: 'Frames', value: frames },
          { label: 'Highest break', value: topBreak?.stats.highestBreak ?? 0, note: topBreak?.profile.name },
          { label: 'Breaks 50+', value: sum((s) => s.breaks50) },
          { label: 'Centuries', value: sum((s) => s.centuries) },
          { label: 'Maximums', value: sum((s) => s.maximums) },
        ]}
      />

      <View style={styles.section}>
        <SectionTitle>Leaderboard</SectionTitle>
        <Segmented label="Sort the leaderboard by" options={SORTS} value={sort} onChange={setSort} />
        {rows.length === 0 ? (
          <AppText tone="muted">No saved players have finished a match yet.</AppText>
        ) : null}
        {rows.map((row, index) => (
          <Pressable
            key={row.profile.id}
            onPress={() => router.push({ pathname: '/player/[id]', params: { id: row.profile.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}. ${row.profile.name}`}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.surface, borderColor: index === 0 ? theme.accent : theme.border },
              pressed && { opacity: 0.72 },
            ]}>
            <AppText style={[styles.rank, tabular, { color: index === 0 ? theme.accent : theme.textMuted }]}>{index + 1}</AppText>
            <Avatar name={row.profile.name} colour={row.profile.colour} size={38} />
            <View style={styles.text}>
              <AppText variant="strong" numberOfLines={1}>
                {row.profile.name}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1} style={tabular}>
                {row.stats.matchesPlayed} played · {row.stats.matchesWon} won · high break {row.stats.highestBreak}
              </AppText>
            </View>
            <AppText style={[styles.value, tabular, { color: index === 0 ? theme.accent : theme.text }]}>
              {headline(row.stats, sort)}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 64,
  },
  rank: { width: 22, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  text: { flex: 1, gap: 2 },
  value: { fontSize: 24, fontWeight: '800', minWidth: 48, textAlign: 'right' },
});
