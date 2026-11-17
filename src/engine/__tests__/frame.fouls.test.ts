import { describe, expect, it } from 'vitest';

import { ALL_BALLS, COLOUR_ORDER } from '../balls';
import { calculateFoulPenalty, createFrame, minimumFoulPenalty } from '../frame';
import { ballOnInfo, pointsRemaining } from '../selectors';
import type { BallId, ColourId } from '../types';
import { adjust, foul, makeConfig, miss, points, pot, redsWith, run } from './helpers';

const cfg = makeConfig(2);

/** Reds gone, colour after the last red taken: the yellow is on. */
const toClearance = [...redsWith('blue', 15)];

describe('foul penalty calculation (4 to 7 points)', () => {
  it('is 4 when a red is on and no higher ball is involved', () => {
    const state = createFrame(cfg, 'p1');
    expect(calculateFoulPenalty(state)).toBe(4);
    expect(calculateFoulPenalty(state, { ballInvolved: null })).toBe(4);
  });

  it('uses the ball involved when it is worth more than the ball on', () => {
    const state = createFrame(cfg, 'p1');
    const expected: Record<BallId, number> = { red: 4, yellow: 4, green: 4, brown: 4, blue: 5, pink: 6, black: 7 };
    for (const ball of ALL_BALLS) {
      expect(calculateFoulPenalty(state, { ballInvolved: ball })).toBe(expected[ball]);
    }
  });

  it('uses the value of the ball on in the clearance', () => {
    const expected: Record<ColourId, number> = { yellow: 4, green: 4, brown: 4, blue: 5, pink: 6, black: 7 };
    let state = run(cfg, toClearance);
    for (const colour of COLOUR_ORDER) {
      expect(ballOnInfo(state).ball).toBe(colour);
      expect(calculateFoulPenalty(state)).toBe(expected[colour]);
      expect(minimumFoulPenalty(state)).toBe(expected[colour]);
      if (colour !== 'black') state = run(cfg, [pot(colour)], state);
    }
  });

  it('takes the higher of the ball on and the ball involved', () => {
    const onYellow = run(cfg, toClearance);
    expect(calculateFoulPenalty(onYellow, { ballInvolved: 'black' })).toBe(7);
    expect(calculateFoulPenalty(onYellow, { ballInvolved: 'pink' })).toBe(6);
    const onPink = run(cfg, [...toClearance, pot('yellow'), pot('green'), pot('brown'), pot('blue')]);
    expect(calculateFoulPenalty(onPink, { ballInvolved: 'yellow' })).toBe(6);
    expect(calculateFoulPenalty(onPink, { ballInvolved: 'black' })).toBe(7);
  });

  it('uses the nominated colour after a red has been potted', () => {
    const state = run(cfg, [pot('red')]);
    const expected: Record<ColourId, number> = { yellow: 4, green: 4, brown: 4, blue: 5, pink: 6, black: 7 };
    for (const colour of COLOUR_ORDER) {
      expect(calculateFoulPenalty(state, { declaredOn: colour })).toBe(expected[colour]);
    }
    expect(calculateFoulPenalty(state, { declaredOn: 'yellow', ballInvolved: 'pink' })).toBe(6);
    expect(calculateFoulPenalty(state, { declaredOn: 'black', ballInvolved: 'red' })).toBe(7);
  });

  it('is 7 for a foul after a red but before a colour is nominated', () => {
    const state = run(cfg, [pot('red')]);
    expect(calculateFoulPenalty(state, { noNomination: true })).toBe(7);
  });

  it('never goes below 4 or above 7', () => {
    const state = createFrame(cfg, 'p1');
    for (const ball of ALL_BALLS) {
      const penalty = calculateFoulPenalty(state, { ballInvolved: ball });
      expect(penalty).toBeGreaterThanOrEqual(4);
      expect(penalty).toBeLessThanOrEqual(7);
    }
  });
});

describe('recording a foul', () => {
  it('awards the points to the opponent, ends the break and passes the turn', () => {
    const state = run(cfg, [pot('red'), pot('black'), pot('red'), foul(6, { declaredOn: 'pink' })]);
    expect(points(state, 'p1')).toBe(9);
    expect(points(state, 'p2')).toBe(6);
    expect(state.strikerId).toBe('p2');
    expect(state.phase).toBe('red');
    expect(state.currentBreak).toBe(0);
    expect(state.breakBalls).toEqual([]);
    expect(state.stats.p1.breaks).toEqual([9]);
    expect(state.stats.p1.foulsCommitted).toBe(1);
    expect(state.stats.p1.foulPointsConceded).toBe(6);
    expect(state.stats.p2.pointsFromFouls).toBe(6);
    expect(state.stats.p2.pointsFromPots).toBe(0);
  });

  it('accepts every legal penalty value and rejects anything else', () => {
    for (const penalty of [4, 5, 6, 7]) {
      expect(points(run(cfg, [foul(penalty)]), 'p2')).toBe(penalty);
    }
    for (const penalty of [0, 1, 3, 8, 10, 4.5, -4, Number.NaN]) {
      expect(() => run(cfg, [foul(penalty)])).toThrow('A foul is worth between 4 and 7 points.');
    }
  });

  it('will not accept less than the value of the ball on', () => {
    const onBlue = run(cfg, [...toClearance, pot('yellow'), pot('green'), pot('brown')]);
    expect(() => run(cfg, [foul(4)], onBlue)).toThrow('A foul here is worth at least 5 points.');
    expect(points(run(cfg, [foul(5)], onBlue), 'p2')).toBe(5);
  });

  it('does not change the reds or colours on the table', () => {
    const state = run(cfg, [pot('red'), pot('black'), foul(4)]);
    expect(state.redsRemaining).toBe(14);
    expect(state.colours).toEqual(COLOUR_ORDER);
  });

  it('re-spots a colour potted on a foul in the clearance', () => {
    const before = run(cfg, [...toClearance, pot('yellow')]);
    const after = run(cfg, [foul(7, { kind: 'illegalPot', ballInvolved: 'black' })], before);
    expect(after.colours).toEqual(['green', 'brown', 'blue', 'pink', 'black']);
    expect(ballOnInfo(after).ball).toBe('green');
    expect(after.strikerId).toBe('p2');
    expect(points(after, 'p2')).toBe(7);
  });

  it('keeps reds potted on a foul off the table', () => {
    const state = run(cfg, [foul(4, { kind: 'inOff', redsLost: 2 })]);
    expect(state.redsRemaining).toBe(13);
    expect(pointsRemaining(state)).toBe(13 * 8 + 27);
    expect(state.stats.p1.redsPotted).toBe(0);
    expect(() => run(cfg, [foul(4, { redsLost: 16 })])).toThrow('More reds than remain on the table.');
    expect(() => run(cfg, [foul(4, { redsLost: -1 })])).toThrow('Invalid number of reds.');
  });

  it('moves on to the yellow when the last red goes down on a foul', () => {
    const oneRedLeft = run(cfg, redsWith('black', 14));
    const state = run(cfg, [foul(4, { redsLost: 1 })], oneRedLeft);
    expect(state.redsRemaining).toBe(0);
    expect(state.phase).toBe('clearance');
    expect(ballOnInfo(state).ball).toBe('yellow');
    expect(state.strikerId).toBe('p2');
  });

  it('puts the next player on a red after a foul on a colour', () => {
    const state = run(cfg, [pot('red'), foul(7, { declaredOn: 'black' })]);
    expect(state.phase).toBe('red');
    expect(state.strikerId).toBe('p2');
  });

  it('puts the next player on the yellow after a foul on the colour following the last red', () => {
    const state = run(cfg, [...redsWith('black', 14), pot('red'), foul(7, { declaredOn: 'black' })]);
    expect(state.phase).toBe('clearance');
    expect(ballOnInfo(state).ball).toBe('yellow');
  });
});

describe('options after a foul', () => {
  it('lets the opponent put the offender back in', () => {
    const state = run(cfg, [pot('red'), pot('blue'), foul(4, { after: 'playAgain' })]);
    expect(state.strikerId).toBe('p1');
    expect(points(state, 'p2')).toBe(4);
    expect(state.currentBreak).toBe(0);
    expect(state.phase).toBe('red');
    expect(state.stats.p1.breaks).toEqual([6]);
    expect(state.stats.p1.visits).toBe(2);
    // The offender now misses and the opponent comes to the table as normal.
    expect(run(cfg, [miss()], state).strikerId).toBe('p2');
  });

  it('cancels any free ball when the offender is put back in', () => {
    const state = run(cfg, [foul(4, { after: 'playAgain', freeBall: true })]);
    expect(state.freeBall).toBe(false);
  });

  it('replays the stroke with the same ball on after a foul and a miss', () => {
    const onRed = run(cfg, [foul(4, { after: 'replace' })]);
    expect(onRed.strikerId).toBe('p1');
    expect(onRed.phase).toBe('red');
    expect(onRed.redsRemaining).toBe(15);
    expect(points(onRed, 'p2')).toBe(4);

    // After a red, the striker is still on a colour of their choice.
    const onColour = run(cfg, [pot('red'), foul(7, { after: 'replace', declaredOn: 'black' })]);
    expect(onColour.strikerId).toBe('p1');
    expect(onColour.phase).toBe('colour');
    expect(points(onColour, 'p1')).toBe(1);
    expect(points(onColour, 'p2')).toBe(7);
    expect(onColour.currentBreak).toBe(0);
    expect(points(run(cfg, [pot('black')], onColour), 'p1')).toBe(8);

    // In the clearance the same colour stays on.
    const onGreen = run(cfg, [...toClearance, pot('yellow'), foul(4, { after: 'replace' })]);
    expect(ballOnInfo(onGreen).ball).toBe('green');
    expect(onGreen.strikerId).toBe('p1');
  });

  it('allows repeated misses, each costing the penalty', () => {
    const state = run(cfg, [
      foul(4, { after: 'replace' }),
      foul(4, { after: 'replace' }),
      foul(4, { after: 'replace' }),
      pot('red'),
    ]);
    expect(points(state, 'p2')).toBe(12);
    expect(points(state, 'p1')).toBe(1);
    expect(state.stats.p1.foulsCommitted).toBe(3);
  });

  it('refuses to remove reds when the balls are being replaced', () => {
    expect(() => run(cfg, [foul(4, { after: 'replace', redsLost: 1 })])).toThrow(
      'Reds stay on the table when the balls are replaced.',
    );
  });
});

describe('fouls on the final black', () => {
  const toBlack = [...toClearance, pot('yellow'), pot('green'), pot('brown'), pot('blue'), pot('pink')];

  it('ends the frame: the foul is worth 7', () => {
    const state = run(cfg, toBlack); // p1 leads 110-0 with only the black left
    expect(minimumFoulPenalty(state)).toBe(7);
    const after = run(cfg, [foul(7)], state);
    expect(after.phase).toBe('over');
    expect(after.winnerId).toBe('p1');
    expect(after.endReason).toBe('finalBlackFoul');
    expect(points(after, 'p2')).toBe(7);
  });

  it('hands the frame to the opponent when the foul overturns the lead', () => {
    // p2 trails by 3 with only the black left; p1 goes in-off.
    const state = run(cfg, [...toBlack, adjust('p2', 107)]);
    expect(points(state, 'p1') - points(state, 'p2')).toBe(3);
    const after = run(cfg, [foul(7, { kind: 'inOff' })], state);
    expect(after.phase).toBe('over');
    expect(after.winnerId).toBe('p2');
    expect(points(after, 'p2')).toBe(114);
  });

  it('re-spots the black when the foul leaves the scores level', () => {
    const state = run(cfg, [...toBlack, adjust('p2', 103)]); // 110 v 103
    const after = run(cfg, [foul(7)], state);
    expect(points(after, 'p1')).toBe(points(after, 'p2'));
    expect(after.phase).toBe('respot');
    expect(after.winnerId).toBeNull();
  });

  it('ignores "play again" requests - the frame is decided', () => {
    const after = run(cfg, [...toBlack, foul(7, { after: 'replace' })]);
    expect(after.phase).toBe('over');
  });
});
