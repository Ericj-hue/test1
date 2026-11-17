import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ballsPotted, type PlayerFrameStats, type PlayerTotals } from '@/engine';
import { space, tabular, useTheme } from '@/theme';

export interface StatsColumn {
  key: string;
  label: string;
}

export interface StatsRow {
  id: string;
  name: string;
  highlight?: boolean;
  values: Record<string, string | number>;
}

interface StatsTableProps {
  columns: StatsColumn[];
  rows: StatsRow[];
}

const NAME_WIDTH = 92;
const CELL_WIDTH = 46;

/** One row per player, one column per statistic. Scrolls sideways if it does not fit. */
export function StatsTable({ columns, rows }: StatsTableProps) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View>
        <View style={[styles.row, styles.head, { borderBottomColor: theme.border }]}>
          <View style={styles.nameCell} />
          {columns.map((column) => (
            <AppText key={column.key} variant="label" tone="muted" style={styles.headCell} numberOfLines={1}>
              {column.label}
            </AppText>
          ))}
        </View>
        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <AppText
              numberOfLines={1}
              style={[styles.nameCell, styles.name, { color: row.highlight ? theme.accent : theme.text }]}>
              {row.name}
            </AppText>
            {columns.map((column) => (
              <AppText key={column.key} style={[styles.cell, tabular, { color: theme.textDim }]} numberOfLines={1}>
                {row.values[column.key] ?? '-'}
              </AppText>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export const FRAME_COLUMNS: StatsColumn[] = [
  { key: 'points', label: 'Pts' },
  { key: 'break', label: 'Break' },
  { key: 'reds', label: 'Reds' },
  { key: 'colours', label: 'Cols' },
  { key: 'fouls', label: 'Fouls' },
  { key: 'received', label: 'Pen +' },
];

export function frameStatValues(stats: PlayerFrameStats): Record<string, number> {
  return {
    points: stats.points,
    break: stats.highestBreak,
    reds: stats.redsPotted,
    colours: stats.coloursPotted + stats.freeBallsPotted,
    fouls: stats.foulsCommitted,
    received: stats.pointsFromFouls,
  };
}

export const MATCH_COLUMNS: StatsColumn[] = [
  { key: 'frames', label: 'Frames' },
  { key: 'points', label: 'Pts' },
  { key: 'break', label: 'Break' },
  { key: 'fifty', label: '50+' },
  { key: 'century', label: '100+' },
  { key: 'pots', label: 'Pots' },
  { key: 'fouls', label: 'Fouls' },
  { key: 'received', label: 'Pen +' },
];

export function matchStatValues(totals: PlayerTotals): Record<string, number> {
  return {
    frames: totals.framesWon,
    points: totals.points,
    break: totals.highestBreak,
    fifty: totals.breaks50,
    century: totals.centuries,
    pots: ballsPotted(totals),
    fouls: totals.fouls,
    received: totals.pointsFromFouls,
  };
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  head: { borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 30 },
  nameCell: { width: NAME_WIDTH, paddingRight: space.sm },
  name: { fontSize: 15, fontWeight: '700' },
  headCell: { width: CELL_WIDTH, textAlign: 'center', fontSize: 10 },
  cell: { width: CELL_WIDTH, textAlign: 'center', fontSize: 15, fontWeight: '600' },
});
