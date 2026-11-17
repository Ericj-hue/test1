/**
 * Core data types for the snooker rules engine.
 *
 * Everything in `src/engine` is plain TypeScript with no React / React Native
 * imports, so the rules can be unit-tested in isolation and reused anywhere.
 * All types are JSON-serialisable: the saved game is simply the list of
 * events, and the scoreboard is always re-derived from that list.
 */

export type BallId = 'red' | 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black';
export type ColourId = Exclude<BallId, 'red'>;

/** `standard` = official two-player rules. `multiplayer` = 3-10 player rotation. */
export type GameMode = 'standard' | 'multiplayer';

/**
 * Who receives foul points.
 *  - `opponent`: the only other player (standard two-player mode, always).
 *  - `next`: the next player in the rotation (multiplayer default).
 *  - `all`: every other player receives the penalty.
 *  - `manual`: the scorer picks the receiving player for each foul.
 */
export type FoulDistribution = 'opponent' | 'next' | 'all' | 'manual';

export interface MatchPlayer {
  /** Unique within the match. */
  id: string;
  name: string;
  /** Saved player profile this entrant belongs to, if any. */
  profileId: string | null;
}

export interface MatchConfig {
  mode: GameMode;
  /** Players in rotation order. */
  players: MatchPlayer[];
  /** Total number of frames in the match ("best of N"). */
  bestOf: number;
  /** Reds at the start of each frame. 15 is the international standard. */
  totalReds: number;
  foulDistribution: FoulDistribution;
}

export type FoulKind = 'inOff' | 'noHit' | 'wrongBall' | 'illegalPot' | 'touching' | 'other';

/**
 * What happens after a foul.
 *  - `next`: the next player comes to the table (normal case).
 *  - `playAgain`: the offender is asked to play again from where the balls lie.
 *  - `replace`: "foul and a miss" - balls are put back and the offender replays
 *    the stroke with the same ball on.
 */
export type AfterFoul = 'next' | 'playAgain' | 'replace';

interface EventBase {
  /** Timestamp (ms). Informational only - never used by the rules. */
  at?: number;
}

export interface PotEvent extends EventBase {
  type: 'pot';
  ball: BallId;
  /**
   * A further red that dropped in the same stroke as the red (or free ball)
   * just recorded. This is the only way a red can legally follow a red.
   */
  sameStroke?: boolean;
}

export interface FreeBallPotEvent extends EventBase {
  type: 'freeBallPot';
  /** The colour nominated as the free ball. */
  nominated: ColourId;
}

export interface EndTurnEvent extends EventBase {
  type: 'endTurn';
}

export interface FoulEvent extends EventBase {
  type: 'foul';
  kind: FoulKind;
  /** Penalty points awarded, 4-7. */
  penalty: number;
  /** Highest-value ball involved in the foul, if one was specified. */
  ballInvolved: BallId | null;
  /** The colour the striker had nominated (only relevant after potting a red). */
  declaredOn: ColourId | null;
  /** Reds potted on the foul stroke. They stay off the table. */
  redsLost: number;
  /** The incoming player is awarded a free ball. */
  freeBall: boolean;
  after: AfterFoul;
  /** Receiving player when the match uses manual foul distribution. */
  recipientId: string | null;
}

export interface AdjustScoreEvent extends EventBase {
  type: 'adjustScore';
  playerId: string;
  delta: number;
}

export interface SetRedsEvent extends EventBase {
  type: 'setReds';
  reds: number;
}

export interface SetStrikerEvent extends EventBase {
  type: 'setStriker';
  playerId: string;
}

export interface SetFreeBallEvent extends EventBase {
  type: 'setFreeBall';
  value: boolean;
}

export interface RespotBlackEvent extends EventBase {
  type: 'respotBlack';
  /** Player who plays first at the re-spotted black. */
  firstPlayerId: string;
}

export interface ConcedeEvent extends EventBase {
  type: 'concede';
  /** Player awarded the frame. */
  winnerId: string;
}

export type FrameEvent =
  | PotEvent
  | FreeBallPotEvent
  | EndTurnEvent
  | FoulEvent
  | AdjustScoreEvent
  | SetRedsEvent
  | SetStrikerEvent
  | SetFreeBallEvent
  | RespotBlackEvent
  | ConcedeEvent;

/**
 *  - `red`: a red is the ball on.
 *  - `colour`: a red (or free ball) was just potted - any colour may be played.
 *  - `clearance`: no reds left - colours in ascending order.
 *  - `respot`: scores level after the final black; waiting to hear who plays first.
 *  - `blackOnly`: re-spotted black in play - first score or foul ends the frame.
 *  - `over`: the frame has a winner.
 */
export type Phase = 'red' | 'colour' | 'clearance' | 'respot' | 'blackOnly' | 'over';

export type EndReason = 'cleared' | 'finalBlackFoul' | 'respottedBlack' | 'conceded';

/** One entry in the trail of balls making up the current break. */
export type BreakBall = BallId | 'free';

export interface PlayerFrameStats {
  /** Frame score. */
  points: number;
  pointsFromPots: number;
  /** Points received from other players' fouls. */
  pointsFromFouls: number;
  foulsCommitted: number;
  /** Penalty points this player gave away. */
  foulPointsConceded: number;
  redsPotted: number;
  coloursPotted: number;
  freeBallsPotted: number;
  /** Visits to the table. */
  visits: number;
  highestBreak: number;
  /** Every scoring break in the frame, in order. */
  breaks: number[];
  /** Net manual score corrections. */
  adjustments: number;
}

export interface FrameState {
  phase: Phase;
  redsRemaining: number;
  /** Colours still to be potted, lowest first. All six until the clearance. */
  colours: ColourId[];
  strikerId: string;
  /** A free ball is available for the striker's next stroke. */
  freeBall: boolean;
  /** A further red potted in the same stroke may be recorded. */
  canExtraRed: boolean;
  currentBreak: number;
  breakBalls: BreakBall[];
  breakUsedFreeBall: boolean;
  stats: Record<string, PlayerFrameStats>;
  /** Players still in contention (narrows to the tied leaders at a re-spotted black). */
  eligibleIds: string[];
  winnerId: string | null;
  endReason: EndReason | null;
  /** Player who made a genuine 147 in this frame, if any. */
  maximumBy: string | null;
}

export interface FrameResult {
  winnerId: string;
  endReason: EndReason;
  stats: Record<string, PlayerFrameStats>;
  maximumBy: string | null;
}

export interface FrameRecord {
  /** 1-based frame number. */
  number: number;
  breakerId: string;
  events: FrameEvent[];
  startedAt: number;
  endedAt: number | null;
  /** Set once the frame is finished and the match has moved on. */
  result: FrameResult | null;
}

export type MatchStatus = 'active' | 'finished';

export interface Match {
  id: string;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  status: MatchStatus;
  config: MatchConfig;
  frames: FrameRecord[];
  /** Match winner(s). More than one id means the match was drawn. */
  winnerIds: string[];
}

/** Thrown when an event is not allowed in the current frame state. */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}
