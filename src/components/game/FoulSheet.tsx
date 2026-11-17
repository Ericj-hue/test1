import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip, SectionTitle, Segmented, Stepper, SwitchRow } from '@/components/ui/Controls';
import { Sheet } from '@/components/ui/Sheet';
import {
  ALL_BALLS,
  BALL_NAMES,
  BALL_VALUES,
  calculateFoulPenalty,
  COLOUR_ORDER,
  foulRecipients,
  isFinalBlack,
  minimumFoulPenalty,
  nextPlayerId,
  playerName,
  type AfterFoul,
  type BallId,
  type ColourId,
  type FoulEvent,
  type FoulKind,
  type FrameState,
  type MatchConfig,
} from '@/engine';
import { radius, space, tabular, useTheme } from '@/theme';

import { Ball } from './Ball';

export interface FoulPreset {
  kind?: FoulKind;
  ballInvolved?: BallId;
}

interface FoulSheetProps {
  visible: boolean;
  config: MatchConfig;
  state: FrameState;
  preset: FoulPreset | null;
  onClose: () => void;
  onSubmit: (event: FoulEvent) => void;
}

const KINDS: { value: FoulKind; label: string }[] = [
  { value: 'inOff', label: 'In-off (cue ball potted)' },
  { value: 'noHit', label: 'No ball hit' },
  { value: 'wrongBall', label: 'Wrong ball hit first' },
  { value: 'illegalPot', label: 'Ball potted illegally' },
  { value: 'touching', label: 'Touched or moved a ball' },
  { value: 'other', label: 'Other foul' },
];

const INVOLVED_LABEL: Record<FoulKind, string> = {
  inOff: 'Highest ball involved (optional)',
  noHit: 'Highest ball involved (optional)',
  wrongBall: 'Ball hit first',
  illegalPot: 'Ball potted',
  touching: 'Ball touched',
  other: 'Highest ball involved (optional)',
};

export function FoulSheet(props: FoulSheetProps) {
  if (!props.visible) return null;
  return <FoulForm {...props} />;
}

function FoulForm({ config, state, preset, onClose, onSubmit }: FoulSheetProps) {
  const theme = useTheme();
  const offender = playerName(config, state.strikerId);
  const onColour = state.phase === 'colour';
  const finalBlack = isFinalBlack(state);
  const manualRecipient = config.mode === 'multiplayer' && config.foulDistribution === 'manual';

  const [kind, setKind] = useState<FoulKind | null>(preset?.kind ?? null);
  const [ballInvolved, setBallInvolved] = useState<BallId | null>(preset?.ballInvolved ?? null);
  const [declared, setDeclared] = useState<ColourId | 'none' | null>(null);
  const [override, setOverride] = useState<number | null>(null);
  const [redsLost, setRedsLost] = useState(0);
  const [freeBall, setFreeBall] = useState(false);
  const [after, setAfter] = useState<AfterFoul>('next');
  const [recipientId, setRecipientId] = useState<string | null>(null);

  const minimum = minimumFoulPenalty(state);
  const automatic = calculateFoulPenalty(state, {
    ballInvolved,
    declaredOn: declared && declared !== 'none' ? declared : null,
    noNomination: declared === 'none',
  });
  const penalty = override ?? automatic;

  // After a red the penalty depends on the colour being played, so ask for it
  // unless the scorer has picked a value by hand.
  const needsColour = onColour && declared === null && override === null;
  const needsRecipient = manualRecipient && recipientId === null;

  const ballsOnTable: BallId[] = ALL_BALLS.filter((ball) =>
    ball === 'red' ? state.redsRemaining > 0 : state.colours.includes(ball),
  );
  const redsOnTable = (state.phase === 'red' || onColour) && state.redsRemaining > 0;
  const others = config.players.filter((p) => p.id !== state.strikerId);
  const recipients = foulRecipients(state, config, recipientId);
  const nextName = playerName(config, nextPlayerId(state, config, state.strikerId));

  let recipientLabel = 'another player';
  if (recipients.length === 1) recipientLabel = playerName(config, recipients[0]);
  else if (recipients.length > 1) recipientLabel = 'all other players';

  let explanation: string;
  if (state.phase === 'red') explanation = 'Ball on: red (minimum 4)';
  else if (onColour) {
    explanation =
      declared === 'none'
        ? 'No colour nominated: 7'
        : declared
          ? `Ball on: ${declared} (${Math.max(4, BALL_VALUES[declared])})`
          : 'Choose the colour being played';
  } else {
    const on = state.colours[0] ?? 'black';
    explanation = `Ball on: ${on} (${Math.max(4, BALL_VALUES[on])})`;
  }
  if (ballInvolved) explanation += ` · Ball involved: ${ballInvolved} (${BALL_VALUES[ballInvolved]})`;
  if (override !== null) explanation = 'Penalty set by hand';

  const afterText: Record<AfterFoul, string> = {
    next: `${nextName} comes to the table.`,
    playAgain: `${offender} is asked to play again from where the balls have come to rest.`,
    replace: `Foul and a miss: the balls are put back and ${offender} plays the shot again.`,
  };

  const submit = () => {
    onSubmit({
      type: 'foul',
      kind: kind ?? 'other',
      penalty,
      ballInvolved,
      declaredOn: declared && declared !== 'none' ? declared : null,
      redsLost: finalBlack || after === 'replace' ? 0 : redsLost,
      freeBall: !finalBlack && after === 'next' && freeBall,
      after: finalBlack ? 'next' : after,
      recipientId: manualRecipient ? recipientId : null,
    });
  };

  const buttonLabel = needsColour
    ? 'Choose the colour being played'
    : needsRecipient
      ? 'Choose who receives the points'
      : `Foul: ${penalty} to ${recipientLabel}`;

  return (
    <Sheet
      visible
      title={`Foul by ${offender}`}
      subtitle={finalBlack ? 'Only the black is left: this foul ends the frame.' : undefined}
      onClose={onClose}
      footer={
        <Button
          label={buttonLabel}
          variant="danger"
          size="lg"
          disabled={needsColour || needsRecipient}
          onPress={submit}
          testID="foul-confirm"
        />
      }>
      <View style={styles.section}>
        <SectionTitle>What happened?</SectionTitle>
        <View style={styles.wrap}>
          {KINDS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={kind === option.value}
              onPress={() => setKind(kind === option.value ? null : option.value)}
              testID={`foul-kind-${option.value}`}
            />
          ))}
        </View>
      </View>

      {onColour ? (
        <View style={styles.section}>
          <SectionTitle>Colour being played</SectionTitle>
          <BallPicker
            balls={COLOUR_ORDER}
            value={declared !== 'none' ? declared : null}
            onChange={(ball) => setDeclared(ball as ColourId | null)}
            testPrefix="foul-on"
          />
          <View style={styles.wrap}>
            <Chip
              label="No colour nominated (7)"
              selected={declared === 'none'}
              onPress={() => setDeclared(declared === 'none' ? null : 'none')}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>{INVOLVED_LABEL[kind ?? 'other']}</SectionTitle>
        <BallPicker balls={ballsOnTable} value={ballInvolved} onChange={setBallInvolved} testPrefix="foul-ball" />
      </View>

      <View style={[styles.penaltyBox, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
        <View style={styles.penaltyHeader}>
          <View style={styles.flex}>
            <AppText variant="label" tone="muted">
              Penalty
            </AppText>
            <AppText variant="caption" tone="dim">
              {explanation}
            </AppText>
          </View>
          <AppText testID="foul-penalty" maxFontSizeMultiplier={1} style={[styles.penaltyValue, tabular]}>
            {needsColour ? '–' : penalty}
          </AppText>
        </View>
        <View style={styles.penaltyButtons}>
          {[4, 5, 6, 7].map((value) => {
            const selected = !needsColour && penalty === value;
            const disabled = value < minimum;
            return (
              <Pressable
                key={value}
                disabled={disabled}
                onPress={() => setOverride(value === automatic && !needsColour ? null : value)}
                accessibilityRole="button"
                accessibilityLabel={`Set penalty to ${value}`}
                accessibilityState={{ selected, disabled }}
                testID={`foul-value-${value}`}
                style={({ pressed }) => [
                  styles.penaltyButton,
                  {
                    backgroundColor: selected ? theme.danger : theme.surfaceRaised,
                    borderColor: selected ? theme.danger : theme.border,
                  },
                  pressed && { opacity: 0.7 },
                  disabled && { opacity: 0.3 },
                ]}>
                <AppText style={[styles.penaltyButtonText, tabular, { color: selected ? theme.onDanger : theme.text }]}>
                  {value}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {manualRecipient ? (
        <View style={styles.section}>
          <SectionTitle>Who receives the points?</SectionTitle>
          <View style={styles.wrap}>
            {others.map((player) => (
              <Chip
                key={player.id}
                label={player.name}
                selected={recipientId === player.id}
                onPress={() => setRecipientId(player.id)}
                testID={`foul-recipient-${player.id}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {finalBlack ? null : (
        <View style={styles.section}>
          <SectionTitle>After the foul</SectionTitle>
          <Segmented
            label="After the foul"
            value={after}
            onChange={setAfter}
            options={[
              { value: 'next', label: 'Next player' },
              { value: 'playAgain', label: 'Play again' },
              { value: 'replace', label: 'Miss: replace' },
            ]}
          />
          <AppText variant="caption" tone="muted">
            {afterText[after]}
          </AppText>

          {after === 'next' ? (
            <SwitchRow
              title="Free ball"
              description={`${nextName} is snookered after the foul and may nominate any ball.`}
              value={freeBall}
              onChange={setFreeBall}
            />
          ) : null}

          {redsOnTable && after !== 'replace' ? (
            <View style={styles.inline}>
              <View style={styles.flex}>
                <AppText variant="strong">Reds potted on this shot</AppText>
                <AppText variant="caption" tone="muted">
                  They stay off the table and score nothing.
                </AppText>
              </View>
              <Stepper label="Reds potted" value={redsLost} onChange={setRedsLost} min={0} max={state.redsRemaining} />
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

interface BallPickerProps {
  balls: readonly BallId[];
  value: BallId | null;
  onChange: (ball: BallId | null) => void;
  testPrefix: string;
}

/** A row of small balls; tapping the selected ball clears the choice. */
function BallPicker({ balls, value, onChange, testPrefix }: BallPickerProps) {
  const theme = useTheme();
  return (
    <View style={styles.picker}>
      {balls.map((ball) => {
        const selected = value === ball;
        return (
          <Pressable
            key={ball}
            onPress={() => onChange(selected ? null : ball)}
            accessibilityRole="button"
            accessibilityLabel={BALL_NAMES[ball]}
            accessibilityState={{ selected }}
            testID={`${testPrefix}-${ball}`}
            style={({ pressed }) => [
              styles.pick,
              { borderColor: selected ? theme.accent : 'transparent', backgroundColor: selected ? theme.accentSoft : 'transparent' },
              pressed && { opacity: 0.7 },
            ]}>
            <Ball ball={ball} size={34} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pick: { padding: 4, borderRadius: radius.pill, borderWidth: 2 },
  penaltyBox: { borderRadius: radius.lg, borderWidth: 1, padding: space.md, gap: space.md },
  penaltyHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  penaltyValue: { fontSize: 44, fontWeight: '800', lineHeight: 48, minWidth: 40, textAlign: 'right' },
  penaltyButtons: { flexDirection: 'row', gap: space.sm },
  penaltyButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  penaltyButtonText: { fontSize: 18, fontWeight: '800' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
