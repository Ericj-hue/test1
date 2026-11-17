import { COLOUR_ORDER } from '../balls';
import { createFrame, reduceFrame } from '../frame';
import { buildConfig } from '../match';
import type {
  BallId,
  ColourId,
  FoulDistribution,
  FoulEvent,
  FrameEvent,
  FrameState,
  MatchConfig,
} from '../types';

interface ConfigOptions {
  bestOf?: number;
  totalReds?: number;
  foulDistribution?: FoulDistribution;
}

/** Players are `p1`, `p2`, ... in rotation order. */
export function makeConfig(playerCount = 2, options: ConfigOptions = {}): MatchConfig {
  const players = Array.from({ length: playerCount }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    profileId: null,
  }));
  return buildConfig({
    players,
    bestOf: options.bestOf ?? 1,
    totalReds: options.totalReds,
    foulDistribution: options.foulDistribution,
  });
}

export const pot = (ball: BallId): FrameEvent => ({ type: 'pot', ball });
export const extraRed = (): FrameEvent => ({ type: 'pot', ball: 'red', sameStroke: true });
export const miss = (): FrameEvent => ({ type: 'endTurn' });
export const freeBall = (nominated: ColourId): FrameEvent => ({ type: 'freeBallPot', nominated });
export const adjust = (playerId: string, delta: number): FrameEvent => ({ type: 'adjustScore', playerId, delta });

export const foul = (penalty: number, extra: Partial<FoulEvent> = {}): FoulEvent => ({
  type: 'foul',
  kind: 'other',
  penalty,
  ballInvolved: null,
  declaredOn: null,
  redsLost: 0,
  freeBall: false,
  after: 'next',
  recipientId: null,
  ...extra,
});

/** `times` x (red, colour). */
export function redsWith(colour: ColourId, times: number): FrameEvent[] {
  const events: FrameEvent[] = [];
  for (let i = 0; i < times; i++) events.push(pot('red'), pot(colour));
  return events;
}

/** Yellow, green, brown, blue, pink, black. */
export const CLEARANCE: FrameEvent[] = COLOUR_ORDER.map((colour) => pot(colour));

/** Applies events strictly: an illegal event throws. */
export function run(config: MatchConfig, events: FrameEvent[], from?: FrameState): FrameState {
  let state = from ?? createFrame(config, config.players[0].id);
  for (const event of events) state = reduceFrame(state, event, config);
  return state;
}

export function points(state: FrameState, playerId: string): number {
  return state.stats[playerId].points;
}

/** Small deterministic random number generator so fuzz tests are repeatable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
