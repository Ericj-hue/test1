/**
 * The frame state machine.
 *
 * A frame is stored as a list of events. `replayFrame` folds that list into the
 * current `FrameState`; nothing else is ever persisted for a frame in progress.
 * This makes undo trivial (drop the last event and replay) and guarantees the
 * scoreboard can never drift out of sync with what was recorded.
 *
 * Rules implemented (WPBSA / international standard):
 *  - Reds and colours alternate while reds remain; colours are re-spotted.
 *  - After the last red a free choice of colour is allowed, then the colours
 *    are potted in ascending order and stay down.
 *  - Fouls are worth the ball on or the ball involved, whichever is higher,
 *    never less than 4 or more than 7.
 *  - A free ball scores the value of the ball on and is re-spotted.
 *  - When only the black remains, the first score or foul ends the frame,
 *    unless the scores are then level - in which case the black is re-spotted.
 */
import { BALL_VALUES, COLOUR_ORDER, MAX_FOUL, MAXIMUM_BREAK, MIN_FOUL, STANDARD_REDS } from './balls';
import {
  RuleError,
  type BallId,
  type BreakBall,
  type ColourId,
  type EndReason,
  type FoulEvent,
  type FrameEvent,
  type FrameState,
  type MatchConfig,
  type PlayerFrameStats,
} from './types';

export function emptyStats(): PlayerFrameStats {
  return {
    points: 0,
    pointsFromPots: 0,
    pointsFromFouls: 0,
    foulsCommitted: 0,
    foulPointsConceded: 0,
    redsPotted: 0,
    coloursPotted: 0,
    freeBallsPotted: 0,
    visits: 0,
    highestBreak: 0,
    breaks: [],
    adjustments: 0,
  };
}

export function createFrame(config: MatchConfig, breakerId: string): FrameState {
  const stats: Record<string, PlayerFrameStats> = {};
  for (const player of config.players) stats[player.id] = emptyStats();
  const strikerId = config.players.some((p) => p.id === breakerId) ? breakerId : config.players[0].id;
  stats[strikerId].visits = 1;
  return {
    phase: config.totalReds > 0 ? 'red' : 'clearance',
    redsRemaining: config.totalReds,
    colours: [...COLOUR_ORDER],
    strikerId,
    freeBall: false,
    canExtraRed: false,
    currentBreak: 0,
    breakBalls: [],
    breakUsedFreeBall: false,
    stats,
    eligibleIds: config.players.map((p) => p.id),
    winnerId: null,
    endReason: null,
    maximumBy: null,
  };
}

/** True while balls can still be played (not waiting on a re-spot decision, not finished). */
export function isInPlay(state: FrameState): boolean {
  return state.phase === 'red' || state.phase === 'colour' || state.phase === 'clearance' || state.phase === 'blackOnly';
}

/** True when the black is the only ball left, so the next score or foul decides the frame. */
export function isFinalBlack(state: FrameState): boolean {
  return state.phase === 'blackOnly' || (state.phase === 'clearance' && state.colours.length === 1);
}

/** A free ball needs a ball other than the ball on to nominate. */
export function canHaveFreeBall(state: FrameState): boolean {
  return state.phase === 'red' || (state.phase === 'clearance' && state.colours.length >= 2);
}

/** Players currently level on the highest score, in rotation order. */
export function leadersOf(state: FrameState, config: MatchConfig): string[] {
  let best = -Infinity;
  for (const player of config.players) best = Math.max(best, state.stats[player.id].points);
  return config.players.filter((p) => state.stats[p.id].points === best).map((p) => p.id);
}

/** The next player in rotation after `fromId` who is still in contention. */
export function nextPlayerId(state: FrameState, config: MatchConfig, fromId: string): string {
  const order = config.players.map((p) => p.id);
  const start = order.indexOf(fromId);
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(start + step) % order.length];
    if (state.eligibleIds.includes(candidate)) return candidate;
  }
  return fromId;
}

/** Players who would receive the penalty for a foul by the current striker. */
export function foulRecipients(
  state: FrameState,
  config: MatchConfig,
  recipientId: string | null = null,
): string[] {
  const offender = state.strikerId;
  const others = config.players.map((p) => p.id).filter((id) => id !== offender);
  if (config.mode === 'standard' || config.foulDistribution === 'opponent') {
    return others.slice(0, 1);
  }
  switch (config.foulDistribution) {
    case 'all':
      return others;
    case 'manual':
      return recipientId && others.includes(recipientId) ? [recipientId] : [];
    case 'next':
    default: {
      const next = nextPlayerId(state, config, offender);
      return next === offender ? others.slice(0, 1) : [next];
    }
  }
}

/** Lowest penalty the current position allows (the value of the ball on, at least 4). */
export function minimumFoulPenalty(state: FrameState): number {
  if (state.phase === 'blackOnly') return MAX_FOUL;
  if (state.phase === 'clearance' && state.colours.length > 0) {
    return Math.max(MIN_FOUL, BALL_VALUES[state.colours[0]]);
  }
  return MIN_FOUL;
}

export interface FoulInput {
  /** Highest-value ball involved in the foul (wrongly hit, potted or touched). */
  ballInvolved?: BallId | null;
  /** The colour the striker was playing, when a red had just been potted. */
  declaredOn?: ColourId | null;
  /** The striker fouled after potting a red but before nominating a colour (7 points). */
  noNomination?: boolean;
}

/**
 * Official penalty: the value of the ball on or of the ball involved,
 * whichever is higher, with a minimum of 4 and a maximum of 7.
 */
export function calculateFoulPenalty(state: FrameState, input: FoulInput = {}): number {
  let on = 0;
  switch (state.phase) {
    case 'red':
      on = BALL_VALUES.red;
      break;
    case 'colour':
      if (input.noNomination) on = MAX_FOUL;
      else if (input.declaredOn) on = BALL_VALUES[input.declaredOn];
      break;
    case 'clearance':
      on = state.colours.length > 0 ? BALL_VALUES[state.colours[0]] : 0;
      break;
    case 'blackOnly':
      on = BALL_VALUES.black;
      break;
    default:
      on = 0;
  }
  const involved = input.ballInvolved ? BALL_VALUES[input.ballInvolved] : 0;
  return Math.min(MAX_FOUL, Math.max(MIN_FOUL, on, involved));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validatePot(state: FrameState, ball: BallId, sameStroke: boolean): string | null {
  switch (state.phase) {
    case 'red':
      if (ball !== 'red') {
        return state.freeBall
          ? 'Use the Free ball button to score a nominated free ball.'
          : 'A red must be potted first.';
      }
      if (state.redsRemaining <= 0) return 'There are no reds left on the table.';
      return null;
    case 'colour':
      if (ball === 'red') {
        // Reds never follow reds - except further reds falling in the same stroke.
        if (!sameStroke || !state.canExtraRed) return 'A colour must be played after a red.';
        if (state.redsRemaining <= 0) return 'There are no reds left on the table.';
      }
      return null;
    case 'clearance': {
      const on = state.colours[0];
      if (ball === on) return null;
      if (ball === 'red') return 'There are no reds left on the table.';
      return state.colours.includes(ball)
        ? `The ${on} must be potted next.`
        : `The ${ball} has already been potted.`;
    }
    case 'blackOnly':
      return ball === 'black' ? null : 'Only the re-spotted black is on the table.';
    case 'respot':
      return 'Choose who plays first at the re-spotted black.';
    case 'over':
      return 'The frame is over.';
  }
}

function validateFoul(state: FrameState, event: FoulEvent, config: MatchConfig): string | null {
  if (!isInPlay(state)) return state.phase === 'over' ? 'The frame is over.' : 'Choose who plays first at the re-spotted black.';
  if (!Number.isInteger(event.penalty) || event.penalty < MIN_FOUL || event.penalty > MAX_FOUL) {
    return `A foul is worth between ${MIN_FOUL} and ${MAX_FOUL} points.`;
  }
  const minimum = minimumFoulPenalty(state);
  if (event.penalty < minimum) return `A foul here is worth at least ${minimum} points.`;
  if (!Number.isInteger(event.redsLost) || event.redsLost < 0) return 'Invalid number of reds.';
  if (event.redsLost > 0) {
    if (state.phase !== 'red' && state.phase !== 'colour') return 'There are no reds left on the table.';
    if (event.redsLost > state.redsRemaining) return 'More reds than remain on the table.';
    if (event.after === 'replace') return 'Reds stay on the table when the balls are replaced.';
  }
  if (event.after !== 'next' && event.after !== 'playAgain' && event.after !== 'replace') {
    return 'Unknown option after the foul.';
  }
  if (foulRecipients(state, config, event.recipientId).length === 0) {
    return 'Choose which player receives the foul points.';
  }
  return null;
}

/** Returns a plain-English reason when `event` is not allowed, otherwise `null`. */
export function validateEvent(state: FrameState, event: FrameEvent, config: MatchConfig): string | null {
  switch (event.type) {
    case 'pot':
      return validatePot(state, event.ball, event.sameStroke === true);

    case 'freeBallPot':
      if (!state.freeBall) return 'No free ball has been awarded.';
      if (state.phase === 'red') return null;
      if (state.phase === 'clearance') {
        if (state.colours.length < 2) return 'There is no other ball to nominate as a free ball.';
        if (event.nominated === state.colours[0]) return 'The free ball must be a different ball from the ball on.';
        if (!state.colours.includes(event.nominated)) return `The ${event.nominated} has already been potted.`;
        return null;
      }
      return 'A free ball is not available now.';

    case 'endTurn':
      if (isInPlay(state)) return null;
      return state.phase === 'over' ? 'The frame is over.' : 'Choose who plays first at the re-spotted black.';

    case 'foul':
      return validateFoul(state, event, config);

    case 'adjustScore': {
      const stats = state.stats[event.playerId];
      if (!stats) return 'Unknown player.';
      if (!Number.isInteger(event.delta) || event.delta === 0) return 'Enter a whole number of points.';
      if (stats.points + event.delta < 0) return 'A score cannot go below zero.';
      return null;
    }

    case 'setReds': {
      const allColoursUp = state.colours.length === COLOUR_ORDER.length;
      const allowed = state.phase === 'red' || state.phase === 'colour' || (state.phase === 'clearance' && allColoursUp);
      if (!allowed) return 'Reds can only be corrected before the colours are cleared.';
      if (!Number.isInteger(event.reds) || event.reds < 0 || event.reds > config.totalReds) {
        return `Reds must be between 0 and ${config.totalReds}.`;
      }
      return null;
    }

    case 'setStriker':
      if (!isInPlay(state)) return 'The turn cannot be changed now.';
      if (!state.eligibleIds.includes(event.playerId)) return 'That player is not in this frame.';
      if (event.playerId === state.strikerId) return 'That player is already at the table.';
      return null;

    case 'setFreeBall':
      if (!event.value) return state.freeBall ? null : 'No free ball is active.';
      if (!canHaveFreeBall(state)) return 'A free ball is not possible in this position.';
      if (state.currentBreak > 0 || state.breakBalls.length > 0) {
        return 'A free ball can only be awarded at the start of a visit.';
      }
      return null;

    case 'respotBlack':
      if (state.phase !== 'respot') return 'The black is only re-spotted when scores are level after the final black.';
      if (!state.eligibleIds.includes(event.firstPlayerId)) return 'That player is not in the tie-break.';
      return null;

    case 'concede':
      if (state.phase === 'over') return 'The frame is over.';
      if (!state.stats[event.winnerId]) return 'Unknown player.';
      return null;
  }
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

function cloneState(state: FrameState): FrameState {
  const stats: Record<string, PlayerFrameStats> = {};
  for (const id of Object.keys(state.stats)) {
    stats[id] = { ...state.stats[id], breaks: [...state.stats[id].breaks] };
  }
  return {
    ...state,
    colours: [...state.colours],
    breakBalls: [...state.breakBalls],
    eligibleIds: [...state.eligibleIds],
    stats,
  };
}

function closeBreak(s: FrameState): void {
  if (s.currentBreak > 0) s.stats[s.strikerId].breaks.push(s.currentBreak);
  s.currentBreak = 0;
  s.breakBalls = [];
  s.breakUsedFreeBall = false;
}

function addPot(s: FrameState, config: MatchConfig, value: number, trail: BreakBall): void {
  const stats = s.stats[s.strikerId];
  stats.points += value;
  stats.pointsFromPots += value;
  s.currentBreak += value;
  s.breakBalls.push(trail);
  if (s.currentBreak > stats.highestBreak) stats.highestBreak = s.currentBreak;
  if (s.currentBreak === MAXIMUM_BREAK && !s.breakUsedFreeBall && config.totalReds === STANDARD_REDS) {
    s.maximumBy = s.strikerId;
  }
}

/** Phase a new visit starts in. */
function openingPhase(s: FrameState): 'red' | 'clearance' {
  return s.redsRemaining > 0 ? 'red' : 'clearance';
}

/**
 * Decide the frame once the last ball has been dealt with: a single leader
 * wins, otherwise the black is re-spotted between the players who are level.
 */
function settle(s: FrameState, config: MatchConfig, reason: EndReason): void {
  closeBreak(s);
  s.freeBall = false;
  s.canExtraRed = false;
  s.colours = [];
  const top = leadersOf(s, config);
  if (top.length === 1) {
    s.phase = 'over';
    s.winnerId = top[0];
    s.endReason = reason;
  } else {
    s.phase = 'respot';
    s.eligibleIds = top;
    s.winnerId = null;
    s.endReason = null;
  }
}

function passTurn(s: FrameState, config: MatchConfig): void {
  s.strikerId = nextPlayerId(s, config, s.strikerId);
  s.stats[s.strikerId].visits += 1;
}

/** Applies an event that has already been validated. */
function applyEvent(state: FrameState, event: FrameEvent, config: MatchConfig): FrameState {
  const s = cloneState(state);

  switch (event.type) {
    case 'pot': {
      const stats = s.stats[s.strikerId];
      const wasRespot = state.phase === 'blackOnly';
      s.freeBall = false;
      if (event.ball === 'red') {
        s.redsRemaining -= 1;
        stats.redsPotted += 1;
        s.phase = 'colour';
        s.canExtraRed = s.redsRemaining > 0;
        addPot(s, config, BALL_VALUES.red, 'red');
        return s;
      }
      stats.coloursPotted += 1;
      s.canExtraRed = false;
      addPot(s, config, BALL_VALUES[event.ball], event.ball);
      if (state.phase === 'colour') {
        // The colour is re-spotted; back to a red, or on to the yellow after the last red.
        s.phase = openingPhase(s);
      } else {
        // Clearance or re-spotted black: the colour stays down.
        s.colours = s.colours.slice(1);
        if (s.colours.length === 0) settle(s, config, wasRespot ? 'respottedBlack' : 'cleared');
      }
      return s;
    }

    case 'freeBallPot': {
      const stats = s.stats[s.strikerId];
      s.freeBall = false;
      s.breakUsedFreeBall = true;
      stats.freeBallsPotted += 1;
      if (state.phase === 'red') {
        // Counts as a red: one point, then any colour. The free ball is re-spotted.
        addPot(s, config, BALL_VALUES.red, 'free');
        s.phase = 'colour';
        s.canExtraRed = s.redsRemaining > 0;
      } else {
        // Counts as the lowest colour, which stays on the table as the ball on.
        addPot(s, config, BALL_VALUES[s.colours[0]], 'free');
      }
      return s;
    }

    case 'endTurn': {
      closeBreak(s);
      s.freeBall = false;
      s.canExtraRed = false;
      if (s.phase === 'colour') s.phase = openingPhase(s);
      passTurn(s, config);
      return s;
    }

    case 'foul': {
      const offender = s.strikerId;
      const recipients = foulRecipients(state, config, event.recipientId);
      const offenderStats = s.stats[offender];
      offenderStats.foulsCommitted += 1;
      offenderStats.foulPointsConceded += event.penalty * recipients.length;
      for (const id of recipients) {
        s.stats[id].points += event.penalty;
        s.stats[id].pointsFromFouls += event.penalty;
      }
      closeBreak(s);
      s.canExtraRed = false;

      if (isFinalBlack(state)) {
        settle(s, config, state.phase === 'blackOnly' ? 'respottedBlack' : 'finalBlackFoul');
        return s;
      }

      if (event.after === 'replace') {
        // Foul and a miss: balls go back, same striker, same ball on.
        s.phase = state.phase;
        s.freeBall = state.freeBall;
        offenderStats.visits += 1;
        return s;
      }

      s.redsRemaining -= event.redsLost;
      s.phase = openingPhase(s);
      if (event.after === 'playAgain') {
        s.freeBall = false;
        offenderStats.visits += 1;
      } else {
        passTurn(s, config);
        s.freeBall = event.freeBall && canHaveFreeBall(s);
      }
      return s;
    }

    case 'adjustScore': {
      const stats = s.stats[event.playerId];
      stats.points += event.delta;
      stats.adjustments += event.delta;
      // A correction after the final black can change (or create) the result.
      if (s.phase === 'respot' || (s.phase === 'over' && s.endReason !== 'conceded')) {
        const reason = s.endReason ?? 'cleared';
        const top = leadersOf(s, config);
        if (top.length === 1) {
          s.phase = 'over';
          s.winnerId = top[0];
          s.endReason = reason;
        } else {
          s.phase = 'respot';
          s.eligibleIds = top;
          s.winnerId = null;
          s.endReason = null;
        }
      }
      return s;
    }

    case 'setReds': {
      s.redsRemaining = event.reds;
      s.canExtraRed = false;
      if (s.phase === 'red' && s.redsRemaining === 0) s.phase = 'clearance';
      else if (s.phase === 'clearance' && s.redsRemaining > 0) s.phase = 'red';
      if (!canHaveFreeBall(s)) s.freeBall = false;
      return s;
    }

    case 'setStriker': {
      closeBreak(s);
      s.freeBall = false;
      s.canExtraRed = false;
      if (s.phase === 'colour') s.phase = openingPhase(s);
      s.strikerId = event.playerId;
      s.stats[s.strikerId].visits += 1;
      return s;
    }

    case 'setFreeBall': {
      s.freeBall = event.value;
      return s;
    }

    case 'respotBlack': {
      closeBreak(s);
      s.phase = 'blackOnly';
      s.colours = ['black'];
      s.strikerId = event.firstPlayerId;
      s.stats[s.strikerId].visits += 1;
      return s;
    }

    case 'concede': {
      closeBreak(s);
      s.freeBall = false;
      s.canExtraRed = false;
      s.phase = 'over';
      s.winnerId = event.winnerId;
      s.endReason = 'conceded';
      return s;
    }
  }
}

/** Validates then applies `event`. Throws `RuleError` if the event is illegal. */
export function reduceFrame(state: FrameState, event: FrameEvent, config: MatchConfig): FrameState {
  const problem = validateEvent(state, event, config);
  if (problem) throw new RuleError(problem);
  return applyEvent(state, event, config);
}

/**
 * Rebuilds the frame from its event list. Events that are not legal in the
 * position they were recorded in are skipped rather than thrown, so a damaged
 * save file can never crash the scoreboard.
 */
export function replayFrame(config: MatchConfig, breakerId: string, events: readonly FrameEvent[]): FrameState {
  let state = createFrame(config, breakerId);
  for (const event of events) {
    if (validateEvent(state, event, config) === null) {
      state = applyEvent(state, event, config);
    }
  }
  return state;
}
