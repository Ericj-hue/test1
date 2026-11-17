import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ballPadHeight, BallPad } from '@/components/game/BallPad';
import { FoulSheet, type FoulPreset } from '@/components/game/FoulSheet';
import { FrameSummary, RespotPrompt } from '@/components/game/FrameOverlays';
import {
  CorrectSheet,
  EndFrameSheet,
  FreeBallSheet,
  MenuSheet,
  StatsSheet,
  StrikerSheet,
  type MenuAction,
} from '@/components/game/GameSheets';
import { Scoreboard, scoreboardHeight } from '@/components/game/Scoreboard';
import { statusMessage, TablePanel } from '@/components/game/TablePanel';
import { AppText } from '@/components/ui/AppText';
import { Button, IconButton } from '@/components/ui/Button';
import { Chip, EmptyState } from '@/components/ui/Controls';
import { useConfirm } from '@/components/ui/Dialog';
import { goBack, Screen } from '@/components/ui/Screen';
import { useToast } from '@/components/ui/Toast';
import {
  canUndo,
  currentFrame,
  describeEvent,
  formatLabel,
  freeBallValue,
  liveState,
  matchStanding,
  playerName,
  validateEvent,
  type BallAvailability,
  type BallId,
  type FrameEvent,
  type FrameState,
  type Match,
} from '@/engine';
import { feedback } from '@/services/feedback';
import { app, appStore, useApp } from '@/store';
import { MAX_CONTENT_WIDTH, space, useTheme } from '@/theme';

type SheetName = 'menu' | 'foul' | 'correct' | 'endFrame' | 'striker' | 'freeBall' | 'stats';

const FOUL_LABELS = {
  opponent: '',
  next: 'fouls to the next player',
  all: 'fouls to all other players',
  manual: 'foul points chosen each time',
} as const;

export default function GameRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useApp((state) => state.matches.find((m) => m.id === id));

  if (!match) {
    return (
      <Screen title="Match">
        <EmptyState
          icon="alert"
          title="Match not found"
          message="This match is no longer saved on this device."
          action={<Button label="Back to home" variant="primary" onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }
  if (match.status === 'finished') {
    return <Redirect href={{ pathname: '/match/[id]', params: { id: match.id } }} />;
  }
  return <Game match={match} />;
}

/** Keeps the screen on while a frame is being scored. Failures are harmless and ignored. */
function KeepAwake() {
  useEffect(() => {
    const tag = 'snooker-scoring';
    let active = false;
    let cancelled = false;
    activateKeepAwakeAsync(tag)
      .then(() => {
        active = true;
        if (cancelled) void deactivateKeepAwake(tag).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (active) void deactivateKeepAwake(tag).catch(() => {});
    };
  }, []);
  return null;
}

function Game({ match }: { match: Match }) {
  const theme = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const keepAwake = useApp((state) => state.settings.keepAwake);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [foulPreset, setFoulPreset] = useState<FoulPreset | null>(null);
  const [boardSpace, setBoardSpace] = useState<number | null>(null);

  const { config } = match;
  const frame = currentFrame(match);
  const state = liveState(match);
  if (!frame || !state) return null;

  const standing = matchStanding(match);
  const playerCount = config.players.length;
  const contentWidth = Math.min(window.width, MAX_CONTENT_WIDTH) - space.lg * 2;

  // Use the big two-row ball pad whenever the whole scoreboard still fits above it.
  const available = window.height - insets.top - insets.bottom;
  const fixedHeight = 52 + 132 + 44 + 60 + space.md * 5;
  const compact = available - fixedHeight - ballPadHeight(contentWidth, false) < scoreboardHeight(playerCount);

  const strikerName = playerName(config, state.strikerId);
  const status = statusMessage(config, state);
  const inPlay = state.phase !== 'over' && state.phase !== 'respot';

  /** Sounds, vibration and celebrations for what just happened. */
  const announce = (event: FrameEvent, before: FrameState, after: FrameState) => {
    if (event.type === 'pot' || event.type === 'freeBallPot') {
      feedback.pot();
      const gained = after.stats[before.strikerId].pointsFromPots - before.stats[before.strikerId].pointsFromPots;
      const total = before.currentBreak + gained;
      const crossed = (target: number) => before.currentBreak < target && total >= target;
      if (after.maximumBy && !before.maximumBy) {
        feedback.milestone();
        toast.show({ message: `MAXIMUM BREAK! ${strikerName} makes a 147`, tone: 'celebrate', duration: 5000 });
      } else if (crossed(100)) {
        feedback.milestone();
        toast.show({ message: `Century break for ${strikerName}!`, tone: 'celebrate', duration: 3500 });
      } else if (crossed(50)) {
        feedback.milestone();
        toast.show({ message: `${strikerName} passes 50`, tone: 'celebrate' });
      }
    } else if (event.type === 'endTurn') {
      feedback.endTurn();
    } else if (event.type === 'foul') {
      feedback.foul();
    } else {
      feedback.tap();
    }
    if (after.phase === 'over' && before.phase !== 'over') feedback.frameWon();
  };

  const record = (event: FrameEvent): boolean => {
    const result = app().record(match.id, event);
    if (!result.ok) {
      feedback.blocked();
      toast.show({ message: result.error, tone: 'warning' });
      return false;
    }
    const updated = appStore.getState().matches.find((m) => m.id === match.id);
    const after = updated ? liveState(updated) : null;
    if (after) announce(event, state, after);
    return true;
  };

  const openFoul = (preset: FoulPreset | null = null) => {
    setFoulPreset(preset);
    setSheet('foul');
  };

  const onBlocked = (ball: BallId, availability: BallAvailability) => {
    feedback.blocked();
    const reason = validateEvent(state, { type: 'pot', ball }, config) ?? `The ${ball} cannot be scored now.`;
    if (availability === 'gone') {
      toast.show({ message: reason, tone: 'warning' });
      return;
    }
    if (ball === 'red' && state.canExtraRed) {
      toast.show({ message: 'A colour comes next. If another red fell in the same shot, use "+1 red, same shot".', tone: 'warning' });
      return;
    }
    // The ball is on the table but is not the ball on - potting it is a foul.
    toast.show({
      message: `${reason} Potted the ${ball} by mistake?`,
      tone: 'warning',
      actionLabel: 'Record foul',
      onAction: () => openFoul({ kind: 'illegalPot', ballInvolved: ball }),
    });
  };

  const undo = () => {
    if (!canUndo(match)) return;
    const last = frame.events[frame.events.length - 1];
    app().undo(match.id);
    feedback.undo();
    const updated = appStore.getState().matches.find((m) => m.id === match.id);
    const restored = updated ? liveState(updated) : null;
    toast.show({ message: `Undone: ${describeEvent(last, config, restored?.strikerId ?? state.strikerId)}` });
  };

  const endMatch = async () => {
    const hasFrames = standing.framesCompleted > 0;
    const confirmed = await confirm({
      title: 'End the match now?',
      message: hasFrames
        ? 'Completed frames are kept and the match is filed in your history. A frame still in progress is not counted.'
        : 'No frame has been completed yet, so this match will be discarded.',
      confirmLabel: 'End match',
      destructive: true,
    });
    if (!confirmed) return;
    app().finishMatch(match.id);
    if (hasFrames) router.replace({ pathname: '/match/[id]', params: { id: match.id } });
    else router.replace('/');
  };

  const restart = async () => {
    const confirmed = await confirm({
      title: 'Restart this frame?',
      message: `Everything scored in frame ${frame.number} will be cleared. Frames already won are kept.`,
      confirmLabel: 'Restart frame',
      destructive: true,
    });
    if (!confirmed) return;
    app().restartFrame(match.id);
    toast.show({ message: `Frame ${frame.number} restarted` });
  };

  const onMenu = (action: MenuAction) => {
    setSheet(null);
    switch (action) {
      case 'freeBall':
        record({ type: 'setFreeBall', value: !state.freeBall });
        break;
      case 'correct':
      case 'striker':
      case 'stats':
      case 'endFrame':
        setSheet(action);
        break;
      case 'restartFrame':
        void restart();
        break;
      case 'saveExit':
        goBack();
        break;
      case 'endMatch':
        void endMatch();
        break;
    }
  };

  const finish = () => {
    app().finishMatch(match.id);
    router.replace({ pathname: '/match/[id]', params: { id: match.id } });
  };

  const nextFrame = (breakerId: string) => {
    const result = app().nextFrame(match.id, breakerId);
    if (!result.ok) toast.show({ message: result.error, tone: 'warning' });
  };

  const title = config.bestOf > 1 ? `Frame ${frame.number} of ${config.bestOf}` : 'Single frame';
  const subtitle =
    playerCount > 2
      ? `Rotation · ${FOUL_LABELS[config.foulDistribution]}`
      : config.bestOf > 1
        ? `${formatLabel(config.bestOf)} · first to ${standing.target}`
        : 'Standard rules';

  // The scoreboard grows into whatever height is left above the controls.
  const estimatedSpace = available - fixedHeight - ballPadHeight(contentWidth, compact);
  const boardHeight = (boardSpace ?? estimatedSpace) - space.xs - space.md;

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      scroll={false}
      right={<IconButton name="more" label="Frame menu" onPress={() => setSheet('menu')} testID="open-menu" />}>
      {keepAwake ? <KeepAwake /> : null}

      <View style={styles.body}>
        <View style={styles.top} onLayout={(event) => setBoardSpace(Math.round(event.nativeEvent.layout.height))}>
          <ScrollView
            style={styles.boardScroll}
            contentContainerStyle={styles.boardContent}
            showsVerticalScrollIndicator={false}>
            <Scoreboard config={config} state={state} wins={standing.wins} width={contentWidth} maxHeight={boardHeight} />
          </ScrollView>
        </View>

        <View style={styles.bottom}>
          <TablePanel config={config} state={state} width={contentWidth} />

          <View style={styles.status}>
            {state.freeBall ? (
              <Button
                label={`Free ball potted  +${freeBallValue(state)}`}
                icon="bolt"
                size="sm"
                variant="primary"
                onPress={() => setSheet('freeBall')}
                testID="free-ball"
              />
            ) : state.canExtraRed ? (
              <Chip
                label="+1 red, same shot"
                icon="plus"
                onPress={() => record({ type: 'pot', ball: 'red', sameStroke: true })}
                testID="extra-red"
              />
            ) : (
              <AppText
                variant="caption"
                center
                numberOfLines={2}
                testID="status-text"
                style={{ color: status.warn ? theme.danger : theme.textDim }}>
                {status.text}
              </AppText>
            )}
          </View>

          <BallPad
            config={config}
            state={state}
            width={contentWidth}
            compact={compact}
            onPot={(ball) => record({ type: 'pot', ball })}
            onBlocked={onBlocked}
          />

          <View style={[styles.actions, { width: contentWidth }]}>
            <Button label="Undo" icon="undo" size="lg" onPress={undo} disabled={!canUndo(match)} style={styles.side} testID="undo" />
            <Button
              label="End turn"
              icon="endTurn"
              size="lg"
              variant="primary"
              onPress={() => record({ type: 'endTurn' })}
              disabled={!inPlay}
              style={styles.main}
              accessibilityHint="The player missed or played safe"
              testID="end-turn"
            />
            <Button
              label="Foul"
              icon="alert"
              size="lg"
              variant="danger"
              onPress={() => openFoul()}
              disabled={!inPlay}
              style={styles.side}
              testID="foul"
            />
          </View>
        </View>
      </View>

      <MenuSheet visible={sheet === 'menu'} config={config} state={state} onClose={() => setSheet(null)} onAction={onMenu} />
      <FoulSheet
        visible={sheet === 'foul'}
        config={config}
        state={state}
        preset={foulPreset}
        onClose={() => setSheet(null)}
        onSubmit={(event) => {
          if (record(event)) setSheet(null);
        }}
      />
      <CorrectSheet
        visible={sheet === 'correct'}
        config={config}
        state={state}
        onClose={() => setSheet(null)}
        onSubmit={(events) => {
          let ok = true;
          for (const event of events) ok = record(event) && ok;
          if (ok) {
            setSheet(null);
            toast.show({ message: 'Scores corrected' });
          }
        }}
      />
      <EndFrameSheet
        visible={sheet === 'endFrame'}
        config={config}
        state={state}
        onClose={() => setSheet(null)}
        onSubmit={(winnerId) => {
          if (record({ type: 'concede', winnerId })) setSheet(null);
        }}
      />
      <StrikerSheet
        visible={sheet === 'striker'}
        config={config}
        state={state}
        onClose={() => setSheet(null)}
        onSubmit={(playerId) => {
          if (record({ type: 'setStriker', playerId })) setSheet(null);
        }}
      />
      <FreeBallSheet
        visible={sheet === 'freeBall'}
        state={state}
        onClose={() => setSheet(null)}
        onSubmit={(nominated) => {
          if (record({ type: 'freeBallPot', nominated })) setSheet(null);
        }}
      />
      <StatsSheet visible={sheet === 'stats'} match={match} state={state} onClose={() => setSheet(null)} />

      {state.phase === 'over' && sheet === null ? (
        <FrameSummary match={match} state={state} onUndo={undo} onNextFrame={nextFrame} onFinish={finish} />
      ) : null}
      {state.phase === 'respot' && sheet === null ? (
        <RespotPrompt
          config={config}
          state={state}
          onChoose={(playerId) => record({ type: 'respotBlack', firstPlayerId: playerId })}
          onUndo={undo}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  top: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 60 },
  boardScroll: { flexGrow: 0, alignSelf: 'stretch' },
  boardContent: { alignItems: 'center', paddingTop: space.xs, paddingBottom: space.md },
  bottom: { alignItems: 'center', gap: space.md },
  status: { height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  actions: { flexDirection: 'row', gap: space.sm },
  side: { flex: 1 },
  main: { flex: 1.5 },
});
