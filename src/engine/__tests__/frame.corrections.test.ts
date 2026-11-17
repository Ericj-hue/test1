import { describe, expect, it } from 'vitest';

import { ballOnInfo, pointsRemaining } from '../selectors';
import type { FrameEvent } from '../types';
import { adjust, CLEARANCE, makeConfig, miss, points, pot, redsWith, run } from './helpers';

const cfg = makeConfig(2);
const setReds = (reds: number): FrameEvent => ({ type: 'setReds', reds });
const setStriker = (playerId: string): FrameEvent => ({ type: 'setStriker', playerId });
const concede = (winnerId: string): FrameEvent => ({ type: 'concede', winnerId });

describe('manual score correction', () => {
  it('adds or removes points without disturbing the turn or the break', () => {
    const before = run(cfg, [pot('red'), pot('black')]);
    const after = run(cfg, [adjust('p1', -3), adjust('p2', 10)], before);
    expect(points(after, 'p1')).toBe(5);
    expect(points(after, 'p2')).toBe(10);
    expect(after.strikerId).toBe('p1');
    expect(after.currentBreak).toBe(8);
    expect(after.phase).toBe('red');
    expect(after.stats.p1.adjustments).toBe(-3);
    expect(after.stats.p2.adjustments).toBe(10);
    // Potting statistics are untouched by a correction.
    expect(after.stats.p1.pointsFromPots).toBe(8);
    expect(after.stats.p2.pointsFromPots).toBe(0);
  });

  it('cannot take a score below zero', () => {
    expect(() => run(cfg, [adjust('p1', -1)])).toThrow('A score cannot go below zero.');
    expect(() => run(cfg, [pot('red'), adjust('p1', -2)])).toThrow('A score cannot go below zero.');
    expect(points(run(cfg, [pot('red'), adjust('p1', -1)]), 'p1')).toBe(0);
  });

  it('rejects empty or fractional corrections and unknown players', () => {
    expect(() => run(cfg, [adjust('p1', 0)])).toThrow('Enter a whole number of points.');
    expect(() => run(cfg, [adjust('p1', 1.5)])).toThrow('Enter a whole number of points.');
    expect(() => run(cfg, [adjust('nobody', 5)])).toThrow('Unknown player.');
  });

  it('can settle a tie that was waiting for a re-spotted black', () => {
    const short = makeConfig(2, { totalReds: 1 });
    // p1 makes 28 and leaves the black; p2 (wrongly credited with 35) pots it for 42.
    const finished = run(short, [
      pot('red'), pot('black'), ...CLEARANCE.slice(0, 5),
      adjust('p2', 35),
      miss(),
      pot('black'),
    ]);
    expect(points(finished, 'p1')).toBe(28);
    expect(points(finished, 'p2')).toBe(42);
    expect(finished.phase).toBe('over');
    expect(finished.winnerId).toBe('p2');

    // Correcting p2 down to 28 levels the scores: the black must be re-spotted.
    const level = run(short, [adjust('p2', -14)], finished);
    expect(points(level, 'p2')).toBe(28);
    expect(level.phase).toBe('respot');
    expect(level.winnerId).toBeNull();

    const settled = run(short, [adjust('p1', 1)], level);
    expect(settled.phase).toBe('over');
    expect(settled.winnerId).toBe('p1');
  });

  it('can overturn the result of a finished frame', () => {
    const short = makeConfig(2, { totalReds: 1 });
    const finished = run(short, [pot('red'), pot('black'), ...CLEARANCE]);
    expect(finished.winnerId).toBe('p1');
    expect(points(finished, 'p1')).toBe(35);
    const corrected = run(short, [adjust('p2', 40)], finished);
    expect(corrected.phase).toBe('over');
    expect(corrected.winnerId).toBe('p2');
  });

  it('leaves a conceded frame with the player it was awarded to', () => {
    const conceded = run(cfg, [pot('red'), pot('black'), concede('p2')]);
    expect(conceded.winnerId).toBe('p2');
    const corrected = run(cfg, [adjust('p1', 50)], conceded);
    expect(corrected.winnerId).toBe('p2');
    expect(corrected.endReason).toBe('conceded');
  });
});

describe('correcting the number of reds', () => {
  it('changes the reds and the points remaining', () => {
    const state = run(cfg, [setReds(9)]);
    expect(state.redsRemaining).toBe(9);
    expect(pointsRemaining(state)).toBe(9 * 8 + 27);
    expect(state.phase).toBe('red');
  });

  it('moves to the colours when set to zero, and back again', () => {
    const noReds = run(cfg, [setReds(0)]);
    expect(noReds.phase).toBe('clearance');
    expect(ballOnInfo(noReds).ball).toBe('yellow');
    const restored = run(cfg, [setReds(2)], noReds);
    expect(restored.phase).toBe('red');
    expect(restored.redsRemaining).toBe(2);
  });

  it('keeps the colour after a red when corrected mid-break', () => {
    const state = run(cfg, [pot('red'), setReds(0)]);
    expect(state.phase).toBe('colour');
    const next = run(cfg, [pot('black')], state);
    expect(next.phase).toBe('clearance');
  });

  it('is limited to the number of reds in the frame', () => {
    expect(() => run(cfg, [setReds(16)])).toThrow('Reds must be between 0 and 15.');
    expect(() => run(cfg, [setReds(-1)])).toThrow('Reds must be between 0 and 15.');
    expect(() => run(cfg, [setReds(2.5)])).toThrow('Reds must be between 0 and 15.');
  });

  it('is refused once colours have been cleared', () => {
    const state = run(cfg, [...redsWith('black', 15), pot('yellow')]);
    expect(() => run(cfg, [setReds(1)], state)).toThrow('Reds can only be corrected before the colours are cleared.');
  });
});

describe('changing the player at the table', () => {
  it('ends the current break and hands over the turn', () => {
    const state = run(cfg, [pot('red'), pot('blue'), pot('red'), setStriker('p2')]);
    expect(state.strikerId).toBe('p2');
    expect(state.phase).toBe('red');
    expect(state.currentBreak).toBe(0);
    expect(state.stats.p1.breaks).toEqual([7]);
    expect(state.stats.p2.visits).toBe(1);
  });

  it('rejects the player already at the table and strangers', () => {
    expect(() => run(cfg, [setStriker('p1')])).toThrow('That player is already at the table.');
    expect(() => run(cfg, [setStriker('nobody')])).toThrow('That player is not in this frame.');
  });
});

describe('ending a frame by hand', () => {
  it('awards the frame to the chosen player whatever the score', () => {
    const state = run(cfg, [pot('red'), pot('black'), pot('red'), concede('p2')]);
    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('p2');
    expect(state.endReason).toBe('conceded');
    expect(points(state, 'p1')).toBe(9);
    expect(state.stats.p1.breaks).toEqual([9]);
    expect(pointsRemaining(state)).toBe(0);
  });

  it('cannot be done twice or for an unknown player', () => {
    expect(() => run(cfg, [concede('p1'), concede('p2')])).toThrow('The frame is over.');
    expect(() => run(cfg, [concede('nobody')])).toThrow('Unknown player.');
  });
});
