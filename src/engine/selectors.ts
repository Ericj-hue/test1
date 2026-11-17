/**
 * Read-only helpers that turn a `FrameState` into the things the scoreboard shows.
 */
import { ALL_BALLS, BALL_NAMES, BALL_VALUES, MAX_FOUL, MIN_FOUL } from './balls';
import { leadersOf, validateEvent } from './frame';
import type { BallId, ColourId, FrameState, MatchConfig } from './types';

/**
 * Maximum points still available to the player at the table.
 * While reds remain each red can be followed by the black (8 points), then
 * the six colours (27). A free ball adds a ball worth the ball on - plus the
 * colour that may follow it while reds are still on the table.
 */
export function pointsRemaining(state: FrameState): number {
  const colours = state.colours.reduce((sum, c) => sum + BALL_VALUES[c], 0);
  switch (state.phase) {
    case 'red':
      return state.redsRemaining * 8 + colours + (state.freeBall ? 8 : 0);
    case 'colour':
      return state.redsRemaining * 8 + BALL_VALUES.black + colours;
    case 'clearance':
      return colours + (state.freeBall && state.colours.length > 0 ? BALL_VALUES[state.colours[0]] : 0);
    case 'blackOnly':
    case 'respot':
      return BALL_VALUES.black;
    case 'over':
      return 0;
  }
}

export type BallAvailability =
  /** Legal to pot now. */
  | 'on'
  /** Still on the table but not the ball on. */
  | 'off'
  /** No longer on the table. */
  | 'gone';

export function ballAvailability(state: FrameState, config: MatchConfig, ball: BallId): BallAvailability {
  if (state.phase === 'over' || state.phase === 'respot') return 'gone';
  if (ball === 'red') {
    if (state.redsRemaining <= 0) return 'gone';
  } else if (state.phase === 'clearance' || state.phase === 'blackOnly') {
    if (!state.colours.includes(ball)) return 'gone';
  }
  return validateEvent(state, { type: 'pot', ball }, config) === null ? 'on' : 'off';
}

export function allAvailability(state: FrameState, config: MatchConfig): Record<BallId, BallAvailability> {
  const result = {} as Record<BallId, BallAvailability>;
  for (const ball of ALL_BALLS) result[ball] = ballAvailability(state, config, ball);
  return result;
}

/** Colours that may be nominated as a free ball right now. */
export function freeBallChoices(state: FrameState): ColourId[] {
  if (!state.freeBall) return [];
  if (state.phase === 'red') return [...state.colours];
  if (state.phase === 'clearance') return state.colours.slice(1);
  return [];
}

/** Points a potted free ball is worth: the value of the ball on. */
export function freeBallValue(state: FrameState): number {
  if (state.phase === 'red') return BALL_VALUES.red;
  if (state.phase === 'clearance' && state.colours.length > 0) return BALL_VALUES[state.colours[0]];
  return 0;
}

export interface BallOnInfo {
  /** A single ball when one specific ball is on, otherwise `null`. */
  ball: BallId | null;
  label: string;
  hint: string;
}

export function ballOnInfo(state: FrameState): BallOnInfo {
  switch (state.phase) {
    case 'red':
      return state.freeBall
        ? { ball: 'red', label: 'Free ball', hint: 'Nominate any ball as a red, or pot a red' }
        : { ball: 'red', label: 'Red', hint: 'A red must be potted' };
    case 'colour':
      return {
        ball: null,
        label: 'Colour',
        hint: state.redsRemaining === 0 ? 'Any colour after the last red' : 'Any colour may be played',
      };
    case 'clearance': {
      const on = state.colours[0];
      return state.freeBall
        ? { ball: on, label: 'Free ball', hint: `Nominate another ball as the ${on}, or pot the ${on}` }
        : {
            ball: on,
            label: BALL_NAMES[on],
            hint: state.colours.length === 1 ? 'Final black - a pot or foul ends the frame' : 'Colours in order',
          };
    }
    case 'blackOnly':
      return { ball: 'black', label: 'Black', hint: 'Re-spotted black - first score or foul wins' };
    case 'respot':
      return { ball: 'black', label: 'Black', hint: 'Scores level - black is re-spotted' };
    case 'over':
      return { ball: null, label: 'Frame over', hint: '' };
  }
}

export interface FrameLead {
  /** Leader, or `null` when two or more players are level at the top. */
  leaderId: string | null;
  /** Points between first and second place. */
  margin: number;
  leaderIds: string[];
}

export function frameLead(state: FrameState, config: MatchConfig): FrameLead {
  const leaderIds = leadersOf(state, config);
  const scores = config.players.map((p) => state.stats[p.id].points).sort((a, b) => b - a);
  const margin = scores.length > 1 ? scores[0] - scores[1] : scores[0] ?? 0;
  return { leaderId: leaderIds.length === 1 ? leaderIds[0] : null, margin, leaderIds };
}

/**
 * How many penalties `playerId` needs before the points left on the table are
 * enough to draw level. Zero means the frame can still be won on potting alone.
 */
export function snookersRequired(state: FrameState, config: MatchConfig, playerId: string): number {
  if (state.phase === 'over' || state.phase === 'respot') return 0;
  let best = 0;
  for (const player of config.players) best = Math.max(best, state.stats[player.id].points);
  const deficit = best - state.stats[playerId].points;
  const remaining = pointsRemaining(state);
  if (deficit <= remaining) return 0;
  let perFoul = MIN_FOUL;
  if (state.phase === 'clearance' && state.colours.length > 0) {
    perFoul = Math.max(MIN_FOUL, BALL_VALUES[state.colours[0]]);
  } else if (state.phase === 'blackOnly') {
    perFoul = MAX_FOUL;
  }
  return Math.ceil((deficit - remaining) / perFoul);
}

/** Players ordered by frame score, highest first. Ties keep rotation order. */
export function rankedPlayers(state: FrameState, config: MatchConfig): string[] {
  return config.players
    .map((p, index) => ({ id: p.id, index, points: state.stats[p.id].points }))
    .sort((a, b) => b.points - a.points || a.index - b.index)
    .map((entry) => entry.id);
}
