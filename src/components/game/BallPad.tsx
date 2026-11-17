import { StyleSheet, View } from 'react-native';

import { allAvailability, type BallAvailability, type BallId, type FrameState, type MatchConfig } from '@/engine';

import { BallButton } from './Ball';

interface BallPadProps {
  config: MatchConfig;
  state: FrameState;
  width: number;
  /** One row of seven smaller balls, for crowded screens. */
  compact: boolean;
  onPot: (ball: BallId) => void;
  onBlocked: (ball: BallId, availability: BallAvailability) => void;
}

const TOP_ROW: BallId[] = ['red', 'yellow', 'green', 'brown'];
const BOTTOM_ROW: BallId[] = ['blue', 'pink', 'black'];
const SINGLE_ROW: BallId[] = [...TOP_ROW, ...BOTTOM_ROW];

const ROW_GAP = 12;

export function ballSize(width: number, compact: boolean): number {
  if (compact) return Math.max(36, Math.min(54, Math.floor((width - 6 * 6) / 7)));
  return Math.max(48, Math.min(74, Math.floor((width - 3 * 14) / 4)));
}

export function ballPadHeight(width: number, compact: boolean): number {
  const size = ballSize(width, compact);
  return compact ? size : size * 2 + ROW_GAP;
}

/** The seven balls. Only balls that are legally "on" can be scored. */
export function BallPad({ config, state, width, compact, onPot, onBlocked }: BallPadProps) {
  const availability = allAvailability(state, config);
  const size = ballSize(width, compact);

  const renderBall = (ball: BallId) => (
    <BallButton
      key={ball}
      ball={ball}
      size={size}
      availability={availability[ball]}
      badge={ball === 'red' ? state.redsRemaining : undefined}
      onPress={() => onPot(ball)}
      onBlockedPress={() => onBlocked(ball, availability[ball])}
    />
  );

  if (compact) {
    return <View style={[styles.row, { width, gap: 6 }]}>{SINGLE_ROW.map(renderBall)}</View>;
  }
  return (
    <View style={[styles.pad, { width }]}>
      <View style={[styles.row, { gap: 14 }]}>{TOP_ROW.map(renderBall)}</View>
      <View style={[styles.row, { gap: 14 }]}>{BOTTOM_ROW.map(renderBall)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: ROW_GAP, alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
