import { describe, expect, it } from 'vitest';

import { COLOUR_ORDER } from '../balls';
import { calculateFoulPenalty } from '../frame';
import { ballOnInfo, freeBallChoices, freeBallValue, pointsRemaining } from '../selectors';
import type { FrameEvent } from '../types';
import { extraRed, foul, freeBall, makeConfig, miss, points, pot, redsWith, run } from './helpers';

const cfg = makeConfig(2);
const award: FrameEvent = foul(4, { freeBall: true });

describe('free ball with reds on the table', () => {
  it('is offered to the incoming player after a foul', () => {
    const state = run(cfg, [award]);
    expect(state.strikerId).toBe('p2');
    expect(state.freeBall).toBe(true);
    expect(freeBallChoices(state)).toEqual(COLOUR_ORDER);
    expect(freeBallValue(state)).toBe(1);
    expect(ballOnInfo(state).label).toBe('Free ball');
    // An extra "red" and the colour that follows it: 147 + 8.
    expect(pointsRemaining(state)).toBe(155);
  });

  it('scores one point as a red, is re-spotted, and is followed by a colour', () => {
    const state = run(cfg, [award, freeBall('blue')]);
    expect(points(state, 'p2')).toBe(4 + 1);
    expect(state.redsRemaining).toBe(15);
    expect(state.colours).toEqual(COLOUR_ORDER);
    expect(state.phase).toBe('colour');
    expect(state.freeBall).toBe(false);
    expect(state.currentBreak).toBe(1);
    expect(state.breakBalls).toEqual(['free']);
    expect(state.stats.p2.freeBallsPotted).toBe(1);
    expect(state.stats.p2.redsPotted).toBe(0);

    const onRed = run(cfg, [pot('black')], state);
    expect(points(onRed, 'p2')).toBe(12);
    expect(onRed.currentBreak).toBe(8);
    expect(onRed.phase).toBe('red');
    expect(pointsRemaining(onRed)).toBe(147);
    expect(run(cfg, [pot('red')], onRed).redsRemaining).toBe(14);
  });

  it('any colour may be nominated', () => {
    for (const colour of COLOUR_ORDER) {
      expect(points(run(cfg, [award, freeBall(colour)]), 'p2')).toBe(5);
    }
  });

  it('cannot be scored unless it has been awarded', () => {
    expect(() => run(cfg, [freeBall('blue')])).toThrow('No free ball has been awarded.');
    expect(() => run(cfg, [foul(4), freeBall('blue')])).toThrow('No free ball has been awarded.');
  });

  it('must be scored with the free ball action, not as an ordinary colour', () => {
    expect(() => run(cfg, [award, pot('blue')])).toThrow('Use the Free ball button');
  });

  it('is used up by potting an actual red instead', () => {
    const state = run(cfg, [award, pot('red')]);
    expect(state.freeBall).toBe(false);
    expect(state.redsRemaining).toBe(14);
    expect(() => run(cfg, [freeBall('blue')], state)).toThrow('No free ball has been awarded.');
  });

  it('is lost on a miss', () => {
    const state = run(cfg, [award, miss()]);
    expect(state.strikerId).toBe('p1');
    expect(state.freeBall).toBe(false);
    expect(pointsRemaining(state)).toBe(147);
  });

  it('counts reds that fall in the same stroke as the free ball', () => {
    const state = run(cfg, [award, freeBall('pink'), extraRed()]);
    expect(points(state, 'p2')).toBe(4 + 1 + 1);
    expect(state.redsRemaining).toBe(14);
    expect(state.phase).toBe('colour');
  });

  it('is only available for the first stroke of the visit', () => {
    const state = run(cfg, [award, freeBall('blue'), pot('black')]);
    expect(() => run(cfg, [freeBall('blue')], state)).toThrow('No free ball has been awarded.');
  });

  it('values a foul on the free ball at the ball on', () => {
    const state = run(cfg, [award]);
    expect(calculateFoulPenalty(state)).toBe(4);
    const after = run(cfg, [foul(4)], state);
    expect(points(after, 'p1')).toBe(4);
    expect(after.freeBall).toBe(false);
  });

  it('is kept when a foul and a miss puts the balls back', () => {
    const state = run(cfg, [award, foul(4, { after: 'replace' })]);
    expect(state.strikerId).toBe('p2');
    expect(state.freeBall).toBe(true);
    expect(points(state, 'p1')).toBe(4);
    expect(points(state, 'p2')).toBe(4);
  });
});

describe('free ball in the colour clearance', () => {
  // p1 clears the reds and the yellow, then fouls on the green leaving a snooker.
  const onGreen = [...redsWith('blue', 15), pot('yellow'), foul(4, { freeBall: true })];

  it('may be any remaining ball other than the ball on', () => {
    const state = run(cfg, onGreen);
    expect(state.strikerId).toBe('p2');
    expect(ballOnInfo(state).ball).toBe('green');
    expect(freeBallChoices(state)).toEqual(['brown', 'blue', 'pink', 'black']);
    expect(freeBallValue(state)).toBe(3);
    expect(pointsRemaining(state)).toBe(3 + 4 + 5 + 6 + 7 + 3);
    expect(() => run(cfg, [freeBall('green')], state)).toThrow(
      'The free ball must be a different ball from the ball on.',
    );
    expect(() => run(cfg, [freeBall('yellow')], state)).toThrow('The yellow has already been potted.');
  });

  it('scores the value of the ball on, which stays on the table', () => {
    const state = run(cfg, [...onGreen, freeBall('black')]);
    expect(points(state, 'p2')).toBe(4 + 3);
    expect(state.colours).toEqual(['green', 'brown', 'blue', 'pink', 'black']);
    expect(state.phase).toBe('clearance');
    expect(ballOnInfo(state).ball).toBe('green');
    expect(state.freeBall).toBe(false);
    expect(pointsRemaining(state)).toBe(3 + 4 + 5 + 6 + 7);

    const next = run(cfg, [pot('green')], state);
    expect(points(next, 'p2')).toBe(10);
    expect(next.currentBreak).toBe(6);
    expect(ballOnInfo(next).ball).toBe('brown');
  });

  it('lets the player pot the real ball on instead', () => {
    const state = run(cfg, [...onGreen, pot('green')]);
    expect(points(state, 'p2')).toBe(7);
    expect(state.freeBall).toBe(false);
    expect(ballOnInfo(state).ball).toBe('brown');
  });

  it('allows the black to be nominated as the pink when only two balls remain', () => {
    const onPink = [
      ...redsWith('blue', 15),
      pot('yellow'),
      pot('green'),
      pot('brown'),
      pot('blue'),
      foul(6, { freeBall: true }),
    ];
    const state = run(cfg, onPink);
    expect(freeBallChoices(state)).toEqual(['black']);
    const after = run(cfg, [freeBall('black')], state);
    expect(points(after, 'p2')).toBe(6 + 6);
    expect(after.colours).toEqual(['pink', 'black']);
  });

  it('is impossible once only the black remains', () => {
    const onBlack = run(cfg, [
      ...redsWith('blue', 15),
      pot('yellow'),
      pot('green'),
      pot('brown'),
      pot('blue'),
      pot('pink'),
    ]);
    expect(() => run(cfg, [{ type: 'setFreeBall', value: true }], onBlack)).toThrow(
      'A free ball is not possible in this position.',
    );
  });
});

describe('awarding a free ball by hand', () => {
  it('can be granted and cancelled at the start of a visit', () => {
    const granted = run(cfg, [{ type: 'setFreeBall', value: true }]);
    expect(granted.freeBall).toBe(true);
    expect(points(run(cfg, [freeBall('black')], granted), 'p1')).toBe(1);
    const cancelled = run(cfg, [{ type: 'setFreeBall', value: false }], granted);
    expect(cancelled.freeBall).toBe(false);
  });

  it('is refused in the middle of a break', () => {
    expect(() => run(cfg, [pot('red'), pot('blue'), { type: 'setFreeBall', value: true }])).toThrow(
      'A free ball can only be awarded at the start of a visit.',
    );
  });
});
