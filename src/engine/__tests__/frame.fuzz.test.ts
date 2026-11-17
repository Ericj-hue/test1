/**
 * Randomised play-throughs. Thousands of legal (but arbitrary) frames are
 * played to a finish and the scoreboard's bookkeeping is checked after every
 * single shot. This catches invalid states that hand-written cases can miss.
 */
import { describe, expect, it } from 'vitest';

import { ALL_BALLS } from '../balls';
import { createFrame, isFinalBlack, isInPlay, minimumFoulPenalty, reduceFrame, replayFrame, validateEvent } from '../frame';
import { freeBallChoices, pointsRemaining } from '../selectors';
import type { AfterFoul, FoulDistribution, FrameEvent, FrameState, MatchConfig } from '../types';
import { extraRed, foul, makeConfig, miss, pot, seededRandom } from './helpers';

interface FuzzOptions {
  freeBalls: boolean;
}

function randomEvent(state: FrameState, cfg: MatchConfig, random: () => number, options: FuzzOptions): FrameEvent {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

  if (state.phase === 'respot') return { type: 'respotBlack', firstPlayerId: pick(state.eligibleIds) };

  const roll = random();
  if (state.freeBall && roll < 0.45) {
    return { type: 'freeBallPot', nominated: pick(freeBallChoices(state)) };
  }
  if (roll < 0.06 && state.canExtraRed && state.redsRemaining > 0) return extraRed();
  if (roll < 0.62) {
    const legal = ALL_BALLS.filter((ball) => validateEvent(state, { type: 'pot', ball }, cfg) === null);
    if (legal.length > 0) return pot(pick(legal));
  }
  if (roll < 0.88) return miss();

  const minimum = minimumFoulPenalty(state);
  const penalty = minimum + Math.floor(random() * (7 - minimum + 1));
  const after = pick<AfterFoul>(['next', 'next', 'next', 'playAgain', 'replace']);
  const redsOnTable = (state.phase === 'red' || state.phase === 'colour') && state.redsRemaining > 0;
  const redsLost = redsOnTable && after !== 'replace' && random() < 0.25 ? 1 : 0;
  const others = cfg.players.map((p) => p.id).filter((id) => id !== state.strikerId);
  return foul(penalty, {
    after,
    redsLost,
    freeBall: options.freeBalls && random() < 0.35,
    recipientId: cfg.foulDistribution === 'manual' ? pick(others) : null,
  });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function checkInvariants(state: FrameState, cfg: MatchConfig, redsLostToFouls: number): void {
  const ids = cfg.players.map((p) => p.id);

  expect(state.redsRemaining).toBeGreaterThanOrEqual(0);
  expect(state.redsRemaining).toBeLessThanOrEqual(cfg.totalReds);
  expect(sum(ids.map((id) => state.stats[id].redsPotted)) + state.redsRemaining + redsLostToFouls).toBe(cfg.totalReds);

  for (const id of ids) {
    const stats = state.stats[id];
    expect(stats.points).toBe(stats.pointsFromPots + stats.pointsFromFouls + stats.adjustments);
    expect(stats.points).toBeGreaterThanOrEqual(0);
    const openBreak = state.strikerId === id ? state.currentBreak : 0;
    expect(sum(stats.breaks) + openBreak).toBe(stats.pointsFromPots);
    expect(stats.highestBreak).toBe(Math.max(0, openBreak, ...stats.breaks));
  }

  // Every penalty point given away was received by somebody.
  expect(sum(ids.map((id) => state.stats[id].foulPointsConceded))).toBe(
    sum(ids.map((id) => state.stats[id].pointsFromFouls)),
  );

  expect(pointsRemaining(state)).toBeGreaterThanOrEqual(0);
  if (isInPlay(state)) expect(state.eligibleIds).toContain(state.strikerId);
  if (state.phase === 'red') expect(state.redsRemaining).toBeGreaterThan(0);
  if (state.phase === 'clearance') {
    expect(state.redsRemaining).toBe(0);
    expect(state.colours.length).toBeGreaterThan(0);
  }
  if (state.phase === 'red' || state.phase === 'colour') expect(state.colours).toHaveLength(6);
  if (state.freeBall) expect(state.phase === 'red' || state.phase === 'clearance').toBe(true);
  if (state.canExtraRed) expect(state.phase).toBe('colour');

  if (state.phase === 'over') {
    expect(state.winnerId).not.toBeNull();
    expect(pointsRemaining(state)).toBe(0);
    const best = Math.max(...ids.map((id) => state.stats[id].points));
    const top = ids.filter((id) => state.stats[id].points === best);
    expect(top).toEqual([state.winnerId]); // a single, outright leader
  } else {
    expect(state.winnerId).toBeNull();
  }
}

function playFrame(cfg: MatchConfig, seed: number, options: FuzzOptions): { state: FrameState; events: FrameEvent[] } {
  const random = seededRandom(seed);
  const events: FrameEvent[] = [];
  let state = createFrame(cfg, cfg.players[0].id);
  let redsLost = 0;
  let previousRemaining = pointsRemaining(state);

  for (let step = 0; step < 5000 && state.phase !== 'over'; step++) {
    const event = randomEvent(state, cfg, random, options);
    const finalBlack = isFinalBlack(state);
    state = reduceFrame(state, event, cfg);
    events.push(event);
    if (event.type === 'foul' && !finalBlack && event.after !== 'replace') redsLost += event.redsLost;

    checkInvariants(state, cfg, redsLost);

    if (!options.freeBalls) {
      // Without free balls the points on the table can only ever go down...
      const remaining = pointsRemaining(state);
      expect(remaining).toBeLessThanOrEqual(previousRemaining);
      previousRemaining = remaining;
      // ...and nobody can pot more than the frame holds.
      const potted = sum(cfg.players.map((p) => state.stats[p.id].pointsFromPots));
      const ceiling = cfg.totalReds * 8 + 27 + 7 * 20; // generous allowance for re-spotted blacks
      expect(potted).toBeLessThanOrEqual(ceiling);
      if (state.phase !== 'respot' && state.phase !== 'blackOnly' && state.phase !== 'over') {
        expect(potted + remaining).toBeLessThanOrEqual(cfg.totalReds * 8 + 27);
      }
    }

    if (step % 12 === 0) expect(replayFrame(cfg, cfg.players[0].id, events)).toEqual(state);
  }

  expect(state.phase).toBe('over');
  // Rebuilding from the saved event list gives exactly the same scoreboard.
  expect(replayFrame(cfg, cfg.players[0].id, events)).toEqual(state);
  return { state, events };
}

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);
const distributions: FoulDistribution[] = ['next', 'all', 'manual'];

describe('randomised frames', () => {
  it('two-player frames always finish with consistent scores', () => {
    const cfg = makeConfig(2);
    for (const seed of SEEDS) playFrame(cfg, seed, { freeBalls: false });
  });

  it('two-player frames with free balls stay consistent', () => {
    const cfg = makeConfig(2);
    for (const seed of SEEDS) playFrame(cfg, seed * 7 + 3, { freeBalls: true });
  });

  it.each([3, 4, 5, 10])('%i-player frames stay consistent under every foul option', (count) => {
    for (const foulDistribution of distributions) {
      const cfg = makeConfig(count, { foulDistribution });
      for (const seed of SEEDS.slice(0, 30)) {
        playFrame(cfg, seed * 13 + count, { freeBalls: seed % 2 === 0 });
      }
    }
  });

  it('short-format frames (6 and 10 reds) stay consistent', () => {
    for (const totalReds of [6, 10]) {
      const cfg = makeConfig(2, { totalReds });
      for (const seed of SEEDS.slice(0, 30)) playFrame(cfg, seed + totalReds * 1000, { freeBalls: true });
    }
  });

  it('undoing any shot of a random frame restores the previous position', () => {
    const cfg = makeConfig(4, { foulDistribution: 'all' });
    const { events } = playFrame(cfg, 4242, { freeBalls: true });
    let previous = createFrame(cfg, 'p1');
    for (let count = 1; count <= events.length; count++) {
      const current = replayFrame(cfg, 'p1', events.slice(0, count));
      // Dropping the last event and replaying is exactly what "undo" does.
      expect(replayFrame(cfg, 'p1', events.slice(0, count - 1))).toEqual(previous);
      previous = current;
    }
  });
});
