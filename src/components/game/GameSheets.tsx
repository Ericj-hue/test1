/**
 * The smaller panels of the scoring screen: the menu, score correction,
 * ending a frame, changing the player at the table, and the free ball.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Divider, ListRow, SectionTitle, Stepper, SwitchRow } from '@/components/ui/Controls';
import { usePrompt } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import {
  BALL_NAMES,
  freeBallChoices,
  freeBallValue,
  leadersOf,
  matchTotals,
  validateEvent,
  type ColourId,
  type FrameEvent,
  type FrameState,
  type Match,
  type MatchConfig,
} from '@/engine';
import { app, useApp } from '@/store';
import { radius, space, tabular, useTheme } from '@/theme';

import { Ball } from './Ball';
import { FRAME_COLUMNS, frameStatValues, MATCH_COLUMNS, matchStatValues, StatsTable } from './StatsTable';

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export type MenuAction =
  | 'freeBall'
  | 'correct'
  | 'striker'
  | 'stats'
  | 'endFrame'
  | 'restartFrame'
  | 'saveExit'
  | 'endMatch';

interface MenuSheetProps {
  visible: boolean;
  config: MatchConfig;
  state: FrameState;
  onClose: () => void;
  onAction: (action: MenuAction) => void;
}

export function MenuSheet({ visible, config, state, onClose, onAction }: MenuSheetProps) {
  const sound = useApp((s) => s.settings.sound);
  const haptics = useApp((s) => s.settings.haptics);
  const canGrantFreeBall = validateEvent(state, { type: 'setFreeBall', value: !state.freeBall }, config) === null;
  const inPlay = state.phase !== 'over' && state.phase !== 'respot';

  return (
    <Sheet visible={visible} title="Frame menu" onClose={onClose}>
      <View>
        {canGrantFreeBall || state.freeBall ? (
          <ListRow
            icon="bolt"
            title={state.freeBall ? 'Cancel the free ball' : 'Award a free ball'}
            description={
              state.freeBall
                ? 'Remove the free ball that was awarded.'
                : 'The player at the table is snookered after a foul.'
            }
            onPress={() => onAction('freeBall')}
            testID="menu-freeball"
          />
        ) : null}
        <ListRow
          icon="edit"
          title="Correct the scores"
          description="Fix a score or the number of reds."
          onPress={() => onAction('correct')}
          testID="menu-correct"
        />
        {inPlay && state.eligibleIds.length > 1 ? (
          <ListRow
            icon="swap"
            title="Change the player at the table"
            description="Pass the turn to another player."
            onPress={() => onAction('striker')}
            testID="menu-striker"
          />
        ) : null}
        <ListRow
          icon="stats"
          title="Statistics"
          description="This frame and the match so far."
          onPress={() => onAction('stats')}
          testID="menu-stats"
        />
        <ListRow
          icon="flag"
          title="End this frame"
          description="Award the frame when a player concedes."
          onPress={() => onAction('endFrame')}
          testID="menu-endframe"
        />
        <ListRow
          icon="restart"
          title="Restart this frame"
          description="Wipe the frame and break off again."
          onPress={() => onAction('restartFrame')}
          testID="menu-restart"
        />
      </View>
      <Divider />
      <View>
        <SwitchRow icon="sound" title="Sound effects" value={sound} onChange={(value) => app().updateSettings({ sound: value })} />
        <SwitchRow icon="phone" title="Vibration" value={haptics} onChange={(value) => app().updateSettings({ haptics: value })} />
      </View>
      <Divider />
      <View>
        <ListRow
          icon="save"
          title="Save and exit"
          description="The match is saved automatically. Resume it any time."
          onPress={() => onAction('saveExit')}
          testID="menu-save"
        />
        <ListRow icon="exit" title="End the match" destructive onPress={() => onAction('endMatch')} testID="menu-endmatch" />
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Score correction
// ---------------------------------------------------------------------------

interface CorrectSheetProps {
  visible: boolean;
  config: MatchConfig;
  state: FrameState;
  onClose: () => void;
  /** Receives the corrections as events, ready to record. */
  onSubmit: (events: FrameEvent[]) => void;
}

export function CorrectSheet(props: CorrectSheetProps) {
  if (!props.visible) return null;
  return <CorrectForm {...props} />;
}

function CorrectForm({ config, state, onClose, onSubmit }: CorrectSheetProps) {
  const theme = useTheme();
  const prompt = usePrompt();
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(config.players.map((p) => [p.id, state.stats[p.id].points])),
  );
  const [reds, setReds] = useState(state.redsRemaining);
  const canSetReds = validateEvent(state, { type: 'setReds', reds: state.redsRemaining }, config) === null;

  const events: FrameEvent[] = [];
  for (const player of config.players) {
    const delta = scores[player.id] - state.stats[player.id].points;
    if (delta !== 0) events.push({ type: 'adjustScore', playerId: player.id, delta });
  }
  if (canSetReds && reds !== state.redsRemaining) events.push({ type: 'setReds', reds });

  const typeScore = async (playerId: string, name: string) => {
    const entered = await prompt({
      title: `Score for ${name}`,
      message: 'Enter the correct frame score.',
      initialValue: String(scores[playerId]),
      confirmLabel: 'Set',
      maxLength: 3,
      numeric: true,
    });
    if (entered === null) return;
    const value = Number.parseInt(entered, 10);
    if (Number.isFinite(value) && value >= 0) setScores((current) => ({ ...current, [playerId]: Math.min(999, value) }));
  };

  return (
    <Sheet
      visible
      title="Correct the scores"
      subtitle="Corrections can be undone like any other action."
      onClose={onClose}
      footer={
        <Button
          label={events.length === 0 ? 'No changes' : 'Save corrections'}
          variant="primary"
          size="lg"
          disabled={events.length === 0}
          onPress={() => onSubmit(events)}
          testID="correct-save"
        />
      }>
      <View style={styles.list}>
        {config.players.map((player) => {
          const original = state.stats[player.id].points;
          const delta = scores[player.id] - original;
          return (
            <View key={player.id} style={styles.correctRow}>
              <View style={styles.flex}>
                <AppText variant="strong" numberOfLines={1}>
                  {player.name}
                </AppText>
                <AppText variant="caption" tone={delta === 0 ? 'muted' : 'accent'}>
                  {delta === 0 ? `Score ${original}` : `${original} to ${scores[player.id]} (${delta > 0 ? '+' : ''}${delta})`}
                </AppText>
              </View>
              <Pressable
                onPress={() => typeScore(player.id, player.name)}
                accessibilityRole="button"
                accessibilityLabel={`Type a score for ${player.name}`}
                style={[styles.typeButton, { borderColor: theme.border }]}>
                <Icon name="edit" size={16} color={theme.textDim} />
              </Pressable>
              <Stepper
                label={`${player.name} score`}
                value={scores[player.id]}
                min={0}
                max={999}
                onChange={(value) => setScores((current) => ({ ...current, [player.id]: value }))}
              />
            </View>
          );
        })}
      </View>

      {canSetReds ? (
        <>
          <Divider />
          <View style={styles.correctRow}>
            <View style={styles.flex}>
              <AppText variant="strong">Reds on the table</AppText>
              <AppText variant="caption" tone={reds === state.redsRemaining ? 'muted' : 'accent'}>
                {reds === state.redsRemaining ? `Currently ${reds}` : `${state.redsRemaining} to ${reds}`}
              </AppText>
            </View>
            <Stepper label="Reds on the table" value={reds} min={0} max={config.totalReds} onChange={setReds} />
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// End frame / change striker
// ---------------------------------------------------------------------------

interface PlayerRowProps {
  name: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}

function PlayerRow({ name, detail, selected, onPress, testID }: PlayerRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${detail}`}
      testID={testID}
      style={({ pressed }) => [
        styles.playerRow,
        { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accentSoft : theme.surfaceRaised },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={styles.flex}>
        <AppText variant="strong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted">
          {detail}
        </AppText>
      </View>
      {selected ? <Icon name="check" size={20} color={theme.accent} /> : null}
    </Pressable>
  );
}

interface EndFrameSheetProps {
  visible: boolean;
  config: MatchConfig;
  state: FrameState;
  onClose: () => void;
  onSubmit: (winnerId: string) => void;
}

export function EndFrameSheet(props: EndFrameSheetProps) {
  if (!props.visible) return null;
  return <EndFrameForm {...props} />;
}

function EndFrameForm({ config, state, onClose, onSubmit }: EndFrameSheetProps) {
  const leaders = leadersOf(state, config);
  const [winnerId, setWinnerId] = useState<string | null>(leaders.length === 1 ? leaders[0] : null);
  return (
    <Sheet
      visible
      title="End this frame"
      subtitle="Use this when a player concedes. Scores stay as they are."
      onClose={onClose}
      footer={
        <Button
          label={winnerId ? 'Award the frame' : 'Choose the frame winner'}
          variant="primary"
          size="lg"
          disabled={!winnerId}
          onPress={() => winnerId && onSubmit(winnerId)}
          testID="endframe-confirm"
        />
      }>
      <View style={styles.list} accessibilityRole="radiogroup">
        <SectionTitle>Frame goes to</SectionTitle>
        {config.players.map((player) => (
          <PlayerRow
            key={player.id}
            name={player.name}
            detail={`${state.stats[player.id].points} points`}
            selected={winnerId === player.id}
            onPress={() => setWinnerId(player.id)}
            testID={`endframe-${player.id}`}
          />
        ))}
      </View>
    </Sheet>
  );
}

interface StrikerSheetProps {
  visible: boolean;
  config: MatchConfig;
  state: FrameState;
  onClose: () => void;
  onSubmit: (playerId: string) => void;
}

export function StrikerSheet({ visible, config, state, onClose, onSubmit }: StrikerSheetProps) {
  const options = config.players.filter((p) => p.id !== state.strikerId && state.eligibleIds.includes(p.id));
  return (
    <Sheet
      visible={visible}
      title="Who is at the table?"
      subtitle="The current break ends and the chosen player takes over."
      onClose={onClose}>
      <View style={styles.list}>
        {options.map((player) => (
          <PlayerRow
            key={player.id}
            name={player.name}
            detail={`${state.stats[player.id].points} points`}
            selected={false}
            onPress={() => onSubmit(player.id)}
            testID={`striker-${player.id}`}
          />
        ))}
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Free ball
// ---------------------------------------------------------------------------

interface FreeBallSheetProps {
  visible: boolean;
  state: FrameState;
  onClose: () => void;
  onSubmit: (nominated: ColourId) => void;
}

export function FreeBallSheet({ visible, state, onClose, onSubmit }: FreeBallSheetProps) {
  const choices = freeBallChoices(state);
  const value = freeBallValue(state);
  const onName = state.phase === 'red' ? 'a red' : `the ${state.colours[0] ?? 'ball on'}`;
  return (
    <Sheet
      visible={visible}
      title={`Free ball potted (+${value})`}
      subtitle={`Which ball was nominated? It counts as ${onName} and goes back on its spot.`}
      onClose={onClose}>
      <View style={styles.freeBalls}>
        {choices.map((ball) => (
          <Pressable
            key={ball}
            onPress={() => onSubmit(ball)}
            accessibilityRole="button"
            accessibilityLabel={`${BALL_NAMES[ball]} nominated as the free ball`}
            testID={`freeball-${ball}`}
            style={({ pressed }) => [styles.freeBall, pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] }]}>
            <Ball ball={ball} size={56} />
            <AppText variant="caption" tone="dim">
              {BALL_NAMES[ball]}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

interface StatsSheetProps {
  visible: boolean;
  match: Match;
  state: FrameState;
  onClose: () => void;
}

export function StatsSheet({ visible, match, state, onClose }: StatsSheetProps) {
  if (!visible) return null;
  const totals = matchTotals(match, true);
  const players = match.config.players;
  return (
    <Sheet visible title="Statistics" onClose={onClose}>
      <View style={styles.list}>
        <SectionTitle>This frame</SectionTitle>
        <StatsTable
          columns={FRAME_COLUMNS}
          rows={players.map((p) => ({
            id: p.id,
            name: p.name,
            highlight: state.strikerId === p.id,
            values: frameStatValues(state.stats[p.id]),
          }))}
        />
      </View>
      <View style={styles.list}>
        <SectionTitle>Match so far</SectionTitle>
        <StatsTable
          columns={MATCH_COLUMNS}
          rows={players.map((p) => ({ id: p.id, name: p.name, values: matchStatValues(totals[p.id]) }))}
        />
        <AppText variant="caption" tone="muted" style={tabular}>
          Break = highest break. Pen + = points received from fouls.
        </AppText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space.sm },
  correctRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56 },
  typeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  freeBalls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, paddingVertical: space.sm },
  freeBall: { alignItems: 'center', gap: 6 },
});
