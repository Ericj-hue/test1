/**
 * Match management: frames, frame wins, match winner, undo and restart.
 * Every function is pure - it returns a new `Match` and never mutates its input.
 */
import { MAX_PLAYERS, MIN_PLAYERS, STANDARD_REDS } from './balls';
import { reduceFrame, replayFrame } from './frame';
import {
  RuleError,
  type FoulDistribution,
  type FrameEvent,
  type FrameRecord,
  type FrameResult,
  type FrameState,
  type Match,
  type MatchConfig,
  type MatchPlayer,
} from './types';

export const MAX_FRAMES = 99;
export const REDS_OPTIONS = [15, 10, 6] as const;
export const MATCH_FORMATS = [1, 3, 5, 7, 9] as const;

export interface MatchSetup {
  players: MatchPlayer[];
  bestOf: number;
  totalReds?: number;
  /** Only used with three or more players. */
  foulDistribution?: FoulDistribution;
}

/** Two players always use the official rules; three or more use rotation play. */
export function buildConfig(setup: MatchSetup): MatchConfig {
  const mode = setup.players.length === 2 ? 'standard' : 'multiplayer';
  const requested = setup.foulDistribution;
  const foulDistribution: FoulDistribution =
    mode === 'standard' ? 'opponent' : requested && requested !== 'opponent' ? requested : 'next';
  return {
    mode,
    players: setup.players.map((p) => ({ id: p.id, name: p.name.trim(), profileId: p.profileId })),
    bestOf: setup.bestOf,
    totalReds: setup.totalReds ?? STANDARD_REDS,
    foulDistribution,
  };
}

/** Returns a reason when the configuration cannot be played, otherwise `null`. */
export function validateConfig(config: MatchConfig): string | null {
  const count = config.players.length;
  if (count < MIN_PLAYERS) return 'Add at least two players.';
  if (count > MAX_PLAYERS) return `A game can have at most ${MAX_PLAYERS} players.`;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const player of config.players) {
    const name = player.name.trim();
    if (!name) return 'Every player needs a name.';
    if (ids.has(player.id)) return 'Each player can only be added once.';
    if (names.has(name.toLowerCase())) return `Two players are called "${name}". Give each player a different name.`;
    ids.add(player.id);
    names.add(name.toLowerCase());
  }
  if (!Number.isInteger(config.bestOf) || config.bestOf < 1 || config.bestOf > MAX_FRAMES) {
    return `Choose between 1 and ${MAX_FRAMES} frames.`;
  }
  if (!Number.isInteger(config.totalReds) || config.totalReds < 1 || config.totalReds > STANDARD_REDS) {
    return 'A frame starts with between 1 and 15 reds.';
  }
  if (count === 2 && (config.mode !== 'standard' || config.foulDistribution !== 'opponent')) {
    return 'Two-player games use the standard rules.';
  }
  if (count > 2 && (config.mode !== 'multiplayer' || config.foulDistribution === 'opponent')) {
    return 'Choose how foul points are shared in a multiplayer game.';
  }
  return null;
}

function newFrame(number: number, breakerId: string, now: number): FrameRecord {
  return { number, breakerId, events: [], startedAt: now, endedAt: null, result: null };
}

export function createMatch(id: string, config: MatchConfig, now: number, breakerId?: string): Match {
  const problem = validateConfig(config);
  if (problem) throw new RuleError(problem);
  const breaker = breakerId && config.players.some((p) => p.id === breakerId) ? breakerId : config.players[0].id;
  return {
    id,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    status: 'active',
    config,
    frames: [newFrame(1, breaker, now)],
    winnerIds: [],
  };
}

export function currentFrame(match: Match): FrameRecord | null {
  return match.frames.length > 0 ? match.frames[match.frames.length - 1] : null;
}

// Frame records are immutable, so the derived state can be cached per record.
const stateCache = new WeakMap<FrameRecord, FrameState>();

export function frameStateOf(config: MatchConfig, frame: FrameRecord): FrameState {
  let state = stateCache.get(frame);
  if (!state) {
    state = replayFrame(config, frame.breakerId, frame.events);
    stateCache.set(frame, state);
  }
  return state;
}

/** State of the frame being played, or `null` once the match is finished. */
export function liveState(match: Match): FrameState | null {
  if (match.status !== 'active') return null;
  const frame = currentFrame(match);
  return frame ? frameStateOf(match.config, frame) : null;
}

export function resultOf(state: FrameState): FrameResult | null {
  if (state.phase !== 'over' || !state.winnerId || !state.endReason) return null;
  return {
    winnerId: state.winnerId,
    endReason: state.endReason,
    stats: state.stats,
    maximumBy: state.maximumBy,
  };
}

function replaceCurrentFrame(match: Match, frame: FrameRecord, now: number): Match {
  return { ...match, updatedAt: now, frames: [...match.frames.slice(0, -1), frame] };
}

/** Records a scoring event in the current frame. Throws `RuleError` if it is illegal. */
export function recordEvent(match: Match, event: FrameEvent, now: number): Match {
  if (match.status !== 'active') throw new RuleError('This match has finished.');
  const frame = currentFrame(match);
  if (!frame) throw new RuleError('This match has no frame in progress.');
  const next = reduceFrame(frameStateOf(match.config, frame), event, match.config);
  const updated: FrameRecord = { ...frame, events: [...frame.events, { ...event, at: now }] };
  stateCache.set(updated, next);
  return replaceCurrentFrame(match, updated, now);
}

export function canUndo(match: Match): boolean {
  const frame = currentFrame(match);
  return match.status === 'active' && !!frame && frame.events.length > 0;
}

/** Removes the most recent event of the current frame. */
export function undoLastEvent(match: Match, now: number): Match {
  const frame = currentFrame(match);
  if (!canUndo(match) || !frame) return match;
  return replaceCurrentFrame(match, { ...frame, events: frame.events.slice(0, -1) }, now);
}

/** Wipes the current frame back to the break-off. */
export function restartFrame(match: Match, now: number): Match {
  const frame = currentFrame(match);
  if (match.status !== 'active' || !frame) return match;
  return replaceCurrentFrame(match, { ...frame, events: [], startedAt: now, endedAt: null, result: null }, now);
}

/** Results of every frame that has a winner, including a just-finished live frame. */
export function completedResults(match: Match): FrameResult[] {
  const results: FrameResult[] = [];
  for (const frame of match.frames) {
    if (frame.result) {
      results.push(frame.result);
    } else if (match.status === 'active') {
      const result = resultOf(frameStateOf(match.config, frame));
      if (result) results.push(result);
    }
  }
  return results;
}

export interface MatchStanding {
  /** Frames won per player. */
  wins: Record<string, number>;
  /** Total points scored per player over the completed frames. */
  points: Record<string, number>;
  framesCompleted: number;
  framesRemaining: number;
  /** Frames a player needs for an outright majority. */
  target: number;
  /** No further frames can change who wins. */
  decided: boolean;
  /** Players with the most frames. */
  leaderIds: string[];
}

export function matchStanding(match: Match): MatchStanding {
  const wins: Record<string, number> = {};
  const points: Record<string, number> = {};
  for (const player of match.config.players) {
    wins[player.id] = 0;
    points[player.id] = 0;
  }
  const results = completedResults(match);
  for (const result of results) {
    if (wins[result.winnerId] !== undefined) wins[result.winnerId] += 1;
    for (const player of match.config.players) {
      points[player.id] += result.stats[player.id]?.points ?? 0;
    }
  }
  const framesCompleted = results.length;
  const framesRemaining = Math.max(0, match.config.bestOf - framesCompleted);
  const sorted = match.config.players.map((p) => wins[p.id]).sort((a, b) => b - a);
  const first = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  const leaderIds = match.config.players.filter((p) => wins[p.id] === first).map((p) => p.id);
  return {
    wins,
    points,
    framesCompleted,
    framesRemaining,
    target: Math.floor(match.config.bestOf / 2) + 1,
    decided: framesRemaining === 0 || first > second + framesRemaining,
    leaderIds,
  };
}

/**
 * Match winner(s): most frames, then most points if frames are level.
 * More than one id means the match is drawn.
 */
export function decideWinners(match: Match): string[] {
  const standing = matchStanding(match);
  if (standing.framesCompleted === 0) return [];
  if (standing.leaderIds.length === 1) return standing.leaderIds;
  const best = Math.max(...standing.leaderIds.map((id) => standing.points[id]));
  return standing.leaderIds.filter((id) => standing.points[id] === best);
}

/** The break-off rotates through the players from frame to frame. */
export function nextBreakerId(match: Match): string {
  const ids = match.config.players.map((p) => p.id);
  const frame = currentFrame(match);
  if (!frame) return ids[0];
  const index = ids.indexOf(frame.breakerId);
  return ids[(index + 1) % ids.length];
}

/** Closes the finished frame and sets up the next one. */
export function startNextFrame(match: Match, breakerId: string, now: number): Match {
  if (match.status !== 'active') throw new RuleError('This match has finished.');
  const frame = currentFrame(match);
  if (!frame) throw new RuleError('This match has no frame in progress.');
  const result = resultOf(frameStateOf(match.config, frame));
  if (!result) throw new RuleError('The current frame is not finished.');
  if (matchStanding(match).decided) throw new RuleError('The match is already decided.');
  if (!match.config.players.some((p) => p.id === breakerId)) throw new RuleError('Unknown player.');
  const closed: FrameRecord = { ...frame, result, endedAt: now };
  return {
    ...match,
    updatedAt: now,
    frames: [...match.frames.slice(0, -1), closed, newFrame(frame.number + 1, breakerId, now)],
  };
}

/**
 * Ends the match. Finished frames are kept as compact results (their event
 * lists are dropped to keep saved history small); a frame still in progress
 * is discarded.
 */
export function finishMatch(match: Match, now: number): Match {
  if (match.status === 'finished') return match;
  const frames: FrameRecord[] = [];
  for (const frame of match.frames) {
    const result = frame.result ?? resultOf(frameStateOf(match.config, frame));
    if (result) frames.push({ ...frame, events: [], result, endedAt: frame.endedAt ?? now });
  }
  const finished: Match = { ...match, frames, status: 'finished', finishedAt: now, updatedAt: now, winnerIds: [] };
  finished.winnerIds = decideWinners(finished);
  return finished;
}

export function playerName(config: MatchConfig, playerId: string | null | undefined): string {
  return config.players.find((p) => p.id === playerId)?.name ?? 'Unknown';
}
