import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { FrameState, MatchConfig } from '@/engine';
import { NATIVE_DRIVER } from '@/hooks/useCloseRequest';
import { radius, space, tabular, useTheme } from '@/theme';

import { MiniBall } from './Ball';

interface ScoreboardProps {
  config: MatchConfig;
  state: FrameState;
  /** Frames won by each player in the match. */
  wins: Record<string, number>;
  /** Width available for the board. */
  width: number;
  /** Height available for the board. Cards grow to use spare room. */
  maxHeight: number;
}

/** Columns used for each number of players. */
export function scoreboardColumns(playerCount: number): number {
  if (playerCount <= 2) return 2;
  if (playerCount === 3) return 3;
  if (playerCount === 4) return 2;
  return 3;
}

function cardHeight(playerCount: number): number {
  if (playerCount <= 2) return 148;
  if (playerCount === 3) return 112;
  if (playerCount === 4) return 96;
  if (playerCount <= 6) return 92;
  if (playerCount <= 9) return 88;
  return 86;
}

const GAP = 8;

/** Height the board needs to show every player without scrolling. */
export function scoreboardHeight(playerCount: number): number {
  const rows = Math.ceil(playerCount / scoreboardColumns(playerCount));
  return rows * cardHeight(playerCount) + (rows - 1) * GAP;
}

export function Scoreboard({ config, state, wins, width, maxHeight }: ScoreboardProps) {
  const count = config.players.length;
  const columns = scoreboardColumns(count);
  const rows = Math.ceil(count / columns);
  const cardWidth = Math.floor((width - (columns - 1) * GAP) / columns);
  const showFrames = config.bestOf > 1;
  const inPlay = state.phase !== 'over' && state.phase !== 'respot';

  // Cards are at least their standard height and grow into any spare room,
  // so the scores are as large as the screen allows.
  const base = cardHeight(count);
  const limit = count <= 2 ? 250 : Math.round(base * 1.7);
  const fitted = Math.floor((maxHeight - (rows - 1) * GAP) / rows);
  const height = Math.max(base, Math.min(limit, fitted));
  const padding = count <= 2 ? space.md : space.sm;
  const baseScore = count <= 2 ? 64 : count >= 5 ? 30 : 38;
  // Never wider than three digits can fit, so the size does not jump at 100.
  // ...and never taller than the room left between the name and the details line.
  const reserved = count <= 2 ? 50 : 38;
  const scoreSize = Math.floor(
    Math.min(
      baseScore * (height / base),
      (cardWidth - padding * 2) / (3 * 0.64),
      (height - padding * 2 - reserved) / 1.08,
    ),
  );

  return (
    <View style={[styles.grid, { width }]}>
      {config.players.map((player) => {
        const stats = state.stats[player.id];
        const active = inPlay && state.strikerId === player.id;
        const out = state.phase === 'blackOnly' && !state.eligibleIds.includes(player.id);
        return (
          <PlayerCard
            key={player.id}
            name={player.name}
            score={stats.points}
            frames={showFrames ? wins[player.id] ?? 0 : null}
            highestBreak={stats.highestBreak}
            fouls={stats.foulsCommitted}
            active={active}
            winner={state.phase === 'over' && state.winnerId === player.id}
            dimmed={out}
            large={count <= 2}
            dense={count >= 5}
            width={cardWidth}
            height={height}
            scoreSize={scoreSize}
            testID={`player-${player.id}`}
          />
        );
      })}
    </View>
  );
}

interface PlayerCardProps {
  name: string;
  score: number;
  frames: number | null;
  highestBreak: number;
  fouls: number;
  active: boolean;
  winner: boolean;
  dimmed: boolean;
  large: boolean;
  dense: boolean;
  width: number;
  height: number;
  scoreSize: number;
  testID: string;
}

function PlayerCard({
  name,
  score,
  frames,
  highestBreak,
  fouls,
  active,
  winner,
  dimmed,
  large,
  dense,
  width,
  height,
  scoreSize,
  testID,
}: PlayerCardProps) {
  const theme = useTheme();
  const highlighted = active || winner;

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${name}: ${score} points${active ? ', at the table' : ''}${
        frames !== null ? `, ${frames} ${frames === 1 ? 'frame' : 'frames'}` : ''
      }, highest break ${highestBreak}, ${fouls} ${fouls === 1 ? 'foul' : 'fouls'}`}
      style={[
        styles.card,
        {
          width,
          height,
          backgroundColor: highlighted ? theme.accentSoft : theme.surface,
          borderColor: highlighted ? theme.accent : theme.border,
          borderWidth: highlighted ? 2 : 1,
          padding: large ? space.md : space.sm,
          opacity: dimmed ? 0.45 : 1,
        },
      ]}>
      <View style={styles.nameRow}>
        {active ? <MiniBall ball="cue" size={large ? 14 : 11} /> : null}
        <AppText
          numberOfLines={1}
          style={[
            styles.name,
            { fontSize: large ? 16 : dense ? 12 : 13, color: highlighted ? theme.text : theme.textDim },
          ]}>
          {name}
        </AppText>
        {frames !== null ? (
          <View
            style={[
              styles.frames,
              {
                backgroundColor: highlighted ? theme.accent : theme.surfaceRaised,
                minWidth: large ? 28 : 22,
                height: large ? 28 : 22,
              },
            ]}>
            <AppText
              maxFontSizeMultiplier={1}
              style={[
                styles.framesText,
                tabular,
                { fontSize: large ? 15 : 12, color: highlighted ? theme.onAccent : theme.text },
              ]}>
              {frames}
            </AppText>
          </View>
        ) : null}
      </View>

      <PopNumber value={score} size={scoreSize} />

      <AppText numberOfLines={1} style={[styles.meta, tabular, { color: theme.textMuted, fontSize: large ? 13 : 11 }]}>
        {large ? `High break ${highestBreak}  ·  Fouls ${fouls}` : `HB ${highestBreak} · F ${fouls}`}
      </AppText>
    </View>
  );
}

/** A number that gives a quick "pop" whenever it changes. */
function PopNumber({ value, size }: { value: number; size: number }) {
  const theme = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    scale.setValue(1.16);
    Animated.spring(scale, { toValue: 1, useNativeDriver: NATIVE_DRIVER, speed: 22, bounciness: 10 }).start();
  }, [value, scale]);

  return (
    <Animated.View style={[styles.scoreWrap, { transform: [{ scale }] }]}>
      <AppText
        maxFontSizeMultiplier={1}
        numberOfLines={1}
        style={[styles.score, tabular, { fontSize: size, lineHeight: Math.round(size * 1.08), color: theme.text }]}>
        {value}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, justifyContent: 'center' },
  card: { borderRadius: radius.lg, justifyContent: 'space-between', overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  frames: { borderRadius: radius.pill, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  framesText: { fontWeight: '800' },
  scoreWrap: { alignSelf: 'flex-start' },
  score: { fontWeight: '800', letterSpacing: -1 },
  meta: { fontWeight: '600' },
});
