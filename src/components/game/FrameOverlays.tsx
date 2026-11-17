/**
 * Full-screen panels shown at the end of a frame: the frame summary, and the
 * prompt for a re-spotted black when the scores finish level.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip, SectionTitle } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Portal } from '@/components/ui/Portal';
import {
  currentFrame,
  decideWinners,
  endReasonLabel,
  formatLabel,
  matchStanding,
  nextBreakerId,
  playerName,
  rankedPlayers,
  type FrameState,
  type Match,
  type MatchConfig,
} from '@/engine';
import { NATIVE_DRIVER } from '@/hooks/useCloseRequest';
import { MAX_CONTENT_WIDTH, radius, space, tabular, useTheme } from '@/theme';

import { Ball } from './Ball';
import { FRAME_COLUMNS, frameStatValues, StatsTable } from './StatsTable';

function OverlayCard({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 240, useNativeDriver: NATIVE_DRIVER }).start();
  }, [progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View
      accessibilityViewIsModal
      style={[styles.root, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
      <Animated.View style={[styles.scrim, { backgroundColor: theme.scrim, opacity: progress }]} />
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: theme.surfaceSolid, borderColor: theme.border, opacity: progress, transform: [{ translateY }] },
        ]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: theme.border }]}>{footer}</View>
      </Animated.View>
    </View>
  );
}

interface FrameSummaryProps {
  match: Match;
  state: FrameState;
  onUndo: () => void;
  onNextFrame: (breakerId: string) => void;
  onFinish: () => void;
}

export function FrameSummary({ match, state, onUndo, onNextFrame, onFinish }: FrameSummaryProps) {
  const theme = useTheme();
  const { config } = match;
  const frame = currentFrame(match);
  const frameNumber = frame?.number ?? 1;
  const standing = matchStanding(match);
  const winnerName = playerName(config, state.winnerId);
  const ranked = rankedPlayers(state, config);
  const [breakerId, setBreakerId] = useState(() => nextBreakerId(match));

  const matchWinners = standing.decided ? decideWinners(match) : [];
  let matchLine: string;
  if (!standing.decided) {
    matchLine =
      config.players.length === 2
        ? `${config.players[0].name} ${standing.wins[config.players[0].id]} - ${standing.wins[config.players[1].id]} ${config.players[1].name}`
        : `${standing.framesCompleted} of ${config.bestOf} frames played`;
  } else if (matchWinners.length === 1) {
    matchLine = `${playerName(config, matchWinners[0])} wins the match`;
  } else {
    matchLine = `Match drawn: ${matchWinners.map((id) => playerName(config, id)).join(' & ')}`;
  }

  return (
    <Portal>
      <OverlayCard
        footer={
          <View style={styles.footerButtons}>
            {standing.decided ? (
              <Button label="Finish match" variant="primary" size="lg" icon="award" onPress={onFinish} testID="summary-finish" />
            ) : (
              <Button
                label={`Start frame ${frameNumber + 1}`}
                variant="primary"
                size="lg"
                icon="play"
                onPress={() => onNextFrame(breakerId)}
                testID="summary-next"
              />
            )}
            <Button label="Undo last action" variant="ghost" size="sm" icon="undo" onPress={onUndo} testID="summary-undo" />
          </View>
        }>
        <View style={styles.hero}>
          <View style={[styles.trophy, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Icon name="award" size={30} color={theme.accent} />
          </View>
          <AppText variant="label" tone="muted">
            Frame {frameNumber}
            {state.endReason && state.endReason !== 'cleared' ? ` · ${endReasonLabel(state.endReason)}` : ''}
          </AppText>
          <AppText variant="title" center testID="summary-winner">
            {winnerName} wins the frame
          </AppText>
        </View>

        {state.maximumBy ? (
          <View style={[styles.banner, { backgroundColor: theme.accent }]}>
            <AppText style={[styles.bannerText, { color: theme.onAccent }]}>
              MAXIMUM BREAK · 147 by {playerName(config, state.maximumBy)}
            </AppText>
          </View>
        ) : null}

        <View style={styles.scores}>
          {ranked.map((id) => {
            const won = id === state.winnerId;
            return (
              <View
                key={id}
                style={[
                  styles.scoreRow,
                  { borderColor: won ? theme.accent : theme.border, backgroundColor: won ? theme.accentSoft : theme.surfaceRaised },
                ]}>
                <AppText variant="strong" numberOfLines={1} style={styles.flex}>
                  {playerName(config, id)}
                </AppText>
                <AppText style={[styles.scoreValue, tabular, { color: won ? theme.accent : theme.text }]}>
                  {state.stats[id].points}
                </AppText>
              </View>
            );
          })}
        </View>

        <View style={styles.block}>
          <SectionTitle>Frame statistics</SectionTitle>
          <StatsTable
            columns={FRAME_COLUMNS}
            rows={config.players.map((p) => ({
              id: p.id,
              name: p.name,
              highlight: p.id === state.winnerId,
              values: frameStatValues(state.stats[p.id]),
            }))}
          />
        </View>

        <View style={[styles.matchBox, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
          <AppText variant="label" tone="muted">
            {formatLabel(config.bestOf)}
            {config.bestOf > 1 && config.players.length === 2 ? ` · first to ${standing.target}` : ''}
          </AppText>
          <AppText variant="heading" testID="summary-match">
            {matchLine}
          </AppText>
          {standing.decided && config.players.length > 2 ? (
            <AppText variant="caption" tone="muted">
              {config.players.map((p) => `${p.name} ${standing.wins[p.id]}`).join('  ·  ')}
            </AppText>
          ) : null}
        </View>

        {standing.decided ? null : (
          <View style={styles.block}>
            <SectionTitle>{`Frame ${frameNumber + 1} break-off`}</SectionTitle>
            <View style={styles.wrap}>
              {config.players.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={breakerId === p.id}
                  onPress={() => setBreakerId(p.id)}
                  testID={`breaker-${p.id}`}
                />
              ))}
            </View>
          </View>
        )}
      </OverlayCard>
    </Portal>
  );
}

interface RespotPromptProps {
  config: MatchConfig;
  state: FrameState;
  onChoose: (playerId: string) => void;
  onUndo: () => void;
}

export function RespotPrompt({ config, state, onChoose, onUndo }: RespotPromptProps) {
  const theme = useTheme();
  const [tossWinner, setTossWinner] = useState<string | null>(null);
  const eligible = config.players.filter((p) => state.eligibleIds.includes(p.id));
  const level = state.stats[eligible[0]?.id ?? '']?.points ?? 0;

  const toss = () => {
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    if (pick) setTossWinner(pick.id);
  };

  return (
    <Portal>
      <OverlayCard
        footer={<Button label="Undo last action" variant="ghost" size="sm" icon="undo" onPress={onUndo} testID="respot-undo" />}>
        <View style={styles.hero}>
          <Ball ball="black" size={64} />
          <AppText variant="label" tone="muted">
            Scores level at {level}
          </AppText>
          <AppText variant="title" center testID="respot-title">
            Re-spotted black
          </AppText>
          <AppText tone="dim" center>
            The black goes back on its spot and the cue ball is played from the D. The players toss for the choice of who
            plays first. The first score or foul ends the frame.
          </AppText>
        </View>

        <View style={[styles.matchBox, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
          <Button label="Toss a coin" icon="shuffle" onPress={toss} testID="respot-toss" />
          {tossWinner ? (
            <AppText center tone="accent" variant="strong" testID="respot-toss-result">
              {playerName(config, tossWinner)} wins the toss and chooses who plays first.
            </AppText>
          ) : (
            <AppText center tone="muted" variant="caption">
              Or toss a real coin and choose below.
            </AppText>
          )}
        </View>

        <View style={styles.block}>
          <SectionTitle>Who plays first?</SectionTitle>
          {eligible.map((p) => (
            <Button
              key={p.id}
              label={`${p.name} plays first`}
              variant="primary"
              onPress={() => onChoose(p.id)}
              testID={`respot-${p.id}`}
            />
          ))}
        </View>
      </OverlayCard>
    </Portal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  scrim: { ...StyleSheet.absoluteFill },
  card: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH - 40,
    flexShrink: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0px 16px 40px rgba(0, 0, 0, 0.4)',
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { padding: space.xl, gap: space.lg },
  footer: { padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  footerButtons: { gap: space.sm },
  hero: { alignItems: 'center', gap: space.sm },
  trophy: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  bannerText: { textAlign: 'center', fontWeight: '800', letterSpacing: 0.6, fontSize: 14 },
  scores: { gap: space.sm },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  scoreValue: { fontSize: 26, fontWeight: '800' },
  block: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  matchBox: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm, alignItems: 'center' },
});
