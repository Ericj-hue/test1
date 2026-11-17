import { describe, expect, it } from 'vitest';

import { allAvailability, pointsRemaining } from '../selectors';
import type { FrameEvent } from '../types';
import { adjust, foul, makeConfig, miss, points, pot, run } from './helpers';

// A one-red frame keeps the set-up short; the tie-break rules are identical.
const cfg = makeConfig(2, { totalReds: 1 });

/** p2 collects 16 in penalties, p1 makes 23, then p2 pots the black to tie at 23. */
const LEVEL_AFTER_BLACK: FrameEvent[] = [
  foul(4), miss(), foul(4), miss(), foul(4), miss(), foul(4), miss(),
  pot('red'), pot('yellow'), pot('yellow'), pot('green'), pot('brown'), pot('blue'), pot('pink'), miss(),
  pot('black'),
];

describe('re-spotted black', () => {
  it('is called when the scores are level after the final black', () => {
    const state = run(cfg, LEVEL_AFTER_BLACK);
    expect(points(state, 'p1')).toBe(23);
    expect(points(state, 'p2')).toBe(23);
    expect(state.phase).toBe('respot');
    expect(state.winnerId).toBeNull();
    expect(state.eligibleIds).toEqual(['p1', 'p2']);
    expect(pointsRemaining(state)).toBe(7);
  });

  it('waits to be told who plays first', () => {
    const state = run(cfg, LEVEL_AFTER_BLACK);
    expect(() => run(cfg, [pot('black')], state)).toThrow('Choose who plays first at the re-spotted black.');
    expect(() => run(cfg, [miss()], state)).toThrow('Choose who plays first at the re-spotted black.');
    expect(() => run(cfg, [foul(7)], state)).toThrow('Choose who plays first at the re-spotted black.');
    expect(() => run(cfg, [{ type: 'respotBlack', firstPlayerId: 'nobody' }], state)).toThrow(
      'That player is not in the tie-break.',
    );
  });

  it('puts only the black back on the table', () => {
    const state = run(cfg, [...LEVEL_AFTER_BLACK, { type: 'respotBlack', firstPlayerId: 'p1' }]);
    expect(state.phase).toBe('blackOnly');
    expect(state.strikerId).toBe('p1');
    expect(state.colours).toEqual(['black']);
    const availability = allAvailability(state, cfg);
    expect(availability.black).toBe('on');
    expect(availability.red).toBe('gone');
    expect(availability.pink).toBe('gone');
    expect(() => run(cfg, [pot('pink')], state)).toThrow('Only the re-spotted black is on the table.');
  });

  it('lets either player be put in first', () => {
    const state = run(cfg, [...LEVEL_AFTER_BLACK, { type: 'respotBlack', firstPlayerId: 'p2' }]);
    expect(state.strikerId).toBe('p2');
  });

  it('is won by the first player to pot the black', () => {
    const state = run(cfg, [...LEVEL_AFTER_BLACK, { type: 'respotBlack', firstPlayerId: 'p1' }, pot('black')]);
    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('p1');
    expect(state.endReason).toBe('respottedBlack');
    expect(points(state, 'p1')).toBe(30);
    expect(points(state, 'p2')).toBe(23);
  });

  it('continues through misses until someone scores', () => {
    const state = run(cfg, [
      ...LEVEL_AFTER_BLACK,
      { type: 'respotBlack', firstPlayerId: 'p1' },
      miss(), miss(), miss(),
      pot('black'),
    ]);
    expect(state.winnerId).toBe('p2');
    expect(points(state, 'p2')).toBe(30);
  });

  it('is lost by the first player to foul: 7 to the opponent', () => {
    const start = run(cfg, [...LEVEL_AFTER_BLACK, { type: 'respotBlack', firstPlayerId: 'p1' }]);
    expect(() => run(cfg, [foul(4)], start)).toThrow('A foul here is worth at least 7 points.');
    const state = run(cfg, [foul(7, { kind: 'inOff' })], start);
    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('p2');
    expect(state.endReason).toBe('respottedBlack');
    expect(points(state, 'p2')).toBe(30);
  });

  it('cannot be requested when the scores are not level', () => {
    expect(() => run(cfg, [{ type: 'respotBlack', firstPlayerId: 'p1' }])).toThrow(
      'The black is only re-spotted when scores are level after the final black.',
    );
  });

  it('also follows a foul on the final black that levels the scores', () => {
    // p1 on 28 with only the black left, p2 on 21: a 7-point foul makes it 28-28.
    const state = run(cfg, [
      pot('red'), pot('black'), pot('yellow'), pot('green'), pot('brown'), pot('blue'), pot('pink'),
      adjust('p2', 21),
      foul(7),
    ]);
    expect(points(state, 'p1')).toBe(28);
    expect(points(state, 'p2')).toBe(28);
    expect(state.phase).toBe('respot');
    const decided = run(cfg, [{ type: 'respotBlack', firstPlayerId: 'p2' }, pot('black')], state);
    expect(decided.winnerId).toBe('p2');
  });
});
