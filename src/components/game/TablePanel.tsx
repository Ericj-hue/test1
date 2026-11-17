import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import {
  ballOnInfo,
  frameLead,
  playerName,
  pointsRemaining,
  snookersRequired,
  type BreakBall,
  type FrameState,
  type MatchConfig,
} from '@/engine';
import { radius, space, tabular, useTheme } from '@/theme';

import { MiniBall } from './Ball';

interface TablePanelProps {
  config: MatchConfig;
  state: FrameState;
  width: number;
}

const TRAIL_BALL = 14;
const TRAIL_GAP = 3;
const TRAIL_ROWS = 3;
const BREAK_BLOCK = 76;

/** The state of the table: ball on, reds left, points remaining, lead and the current break. */
export function TablePanel({ config, state, width }: TablePanelProps) {
  const theme = useTheme();
  const on = ballOnInfo(state);
  const lead = frameLead(state, config);
  const leaderName = lead.leaderId ? playerName(config, lead.leaderId) : null;

  // Show only as many balls as fit; older ones collapse into a "+N" counter.
  const trailWidth = width - BREAK_BLOCK - space.md * 3;
  const perRow = Math.max(4, Math.floor((trailWidth + TRAIL_GAP) / (TRAIL_BALL + TRAIL_GAP)));
  const capacity = perRow * TRAIL_ROWS;
  const balls = state.breakBalls;
  const hidden = balls.length > capacity ? balls.length - (capacity - 2) : 0;
  const visible: BreakBall[] = hidden > 0 ? balls.slice(hidden) : balls;

  return (
    <View style={[styles.panel, { width, backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.tiles}>
        <Tile label="Ball on" testID="tile-ball-on">
          <View style={styles.ballOn}>
            {on.ball && !state.freeBall ? <MiniBall ball={on.ball} size={18} /> : null}
            <AppText numberOfLines={1} style={[styles.tileValue, styles.ballOnText]}>
              {on.label}
            </AppText>
          </View>
        </Tile>
        <Divider />
        <Tile label="Reds" testID="tile-reds">
          <AppText style={[styles.tileValue, tabular]}>{state.redsRemaining}</AppText>
        </Tile>
        <Divider />
        <Tile label="Remaining" testID="tile-remaining">
          <AppText style={[styles.tileValue, tabular]}>{pointsRemaining(state)}</AppText>
        </Tile>
        <Divider />
        <Tile label="Lead" testID="tile-lead">
          <AppText
            style={[styles.tileValue, tabular]}
            accessibilityLabel={leaderName ? `${leaderName} leads by ${lead.margin}` : 'Scores level'}>
            {leaderName ? `+${lead.margin}` : 'Level'}
          </AppText>
        </Tile>
      </View>

      <View style={[styles.rule, { backgroundColor: theme.border }]} />

      <View style={styles.breakRow}>
        <View style={styles.breakBlock}>
          <AppText variant="label" tone="muted" style={styles.tileLabel}>
            Break
          </AppText>
          <AppText
            testID="current-break"
            maxFontSizeMultiplier={1}
            style={[styles.breakValue, tabular, { color: state.currentBreak > 0 ? theme.accent : theme.textMuted }]}>
            {state.currentBreak}
          </AppText>
        </View>
        <View style={styles.trail} accessibilityLabel={`${balls.length} balls in this break`}>
          {hidden > 0 ? (
            <AppText style={[styles.more, { color: theme.textMuted }]} maxFontSizeMultiplier={1}>
              +{hidden}
            </AppText>
          ) : null}
          {visible.map((ball, index) => (
            <MiniBall key={`${index}-${ball}`} ball={ball} size={TRAIL_BALL} />
          ))}
        </View>
      </View>
    </View>
  );
}

function Tile({ label, children, testID }: { label: string; children: React.ReactNode; testID: string }) {
  return (
    <View style={styles.tile} testID={testID}>
      <AppText variant="label" tone="muted" numberOfLines={1} style={styles.tileLabel}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

/** One-line guidance under the table panel: what is on, or who needs snookers. */
export function statusMessage(config: MatchConfig, state: FrameState): { text: string; warn: boolean } {
  if (state.phase === 'over' || state.phase === 'respot') return { text: ballOnInfo(state).hint, warn: false };
  const striker = playerName(config, state.strikerId);
  const needed = snookersRequired(state, config, state.strikerId);
  if (needed > 0) {
    return { text: `${striker} needs ${needed} ${needed === 1 ? 'snooker' : 'snookers'}`, warn: true };
  }
  return { text: `${striker} - ${ballOnInfo(state).hint.toLowerCase()}`, warn: false };
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  tiles: { flexDirection: 'row', alignItems: 'stretch' },
  tile: { flex: 1, paddingVertical: space.sm, paddingHorizontal: 6, alignItems: 'center', gap: 2, minHeight: 54 },
  tileLabel: { fontSize: 10, letterSpacing: 0.7 },
  tileValue: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  ballOn: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  ballOnText: { fontSize: 16, flexShrink: 1 },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: space.sm },
  rule: { height: StyleSheet.hairlineWidth },
  breakRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.md, minHeight: 62 },
  breakBlock: { width: BREAK_BLOCK, gap: 0 },
  breakValue: { fontSize: 30, fontWeight: '800', lineHeight: 34 },
  trail: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: TRAIL_GAP },
  more: { fontSize: 11, fontWeight: '700', marginRight: 2 },
});
