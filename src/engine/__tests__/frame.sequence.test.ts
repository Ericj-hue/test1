import { describe, expect, it } from 'vitest';

import { COLOUR_ORDER } from '../balls';
import { createFrame } from '../frame';
import { allAvailability, ballOnInfo, pointsRemaining } from '../selectors';
import { RuleError, type ColourId, type FrameEvent } from '../types';
import { CLEARANCE, extraRed, foul, freeBall, makeConfig, miss, points, pot, redsWith, run } from './helpers';

const cfg = makeConfig(2);

describe('opening position', () => {
  it('starts a standard frame with 15 reds, six colours and 147 on the table', () => {
    const state = createFrame(cfg, 'p1');
    expect(state.phase).toBe('red');
    expect(state.redsRemaining).toBe(15);
    expect(state.colours).toEqual(COLOUR_ORDER);
    expect(state.strikerId).toBe('p1');
    expect(state.currentBreak).toBe(0);
    expect(pointsRemaining(state)).toBe(147);
    expect(ballOnInfo(state).ball).toBe('red');
  });

  it('lets a chosen player break off', () => {
    expect(createFrame(cfg, 'p2').strikerId).toBe('p2');
  });
});

describe('red and colour alternation', () => {
  it('requires a red before any colour', () => {
    for (const colour of COLOUR_ORDER) {
      expect(() => run(cfg, [pot(colour)])).toThrow(RuleError);
      expect(() => run(cfg, [pot(colour)])).toThrow('A red must be potted first.');
    }
  });

  it('scores a red, then allows any colour, then returns to a red', () => {
    for (const colour of COLOUR_ORDER) {
      const afterRed = run(cfg, [pot('red')]);
      expect(afterRed.phase).toBe('colour');
      expect(points(afterRed, 'p1')).toBe(1);
      expect(afterRed.redsRemaining).toBe(14);

      const afterColour = run(cfg, [pot(colour)], afterRed);
      expect(afterColour.phase).toBe('red');
      expect(afterColour.redsRemaining).toBe(14);
      expect(afterColour.strikerId).toBe('p1');
    }
  });

  it('gives the correct value for every ball', () => {
    const values: Record<ColourId, number> = { yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 };
    for (const colour of COLOUR_ORDER) {
      const state = run(cfg, [pot('red'), pot(colour)]);
      expect(points(state, 'p1')).toBe(1 + values[colour]);
      expect(state.currentBreak).toBe(1 + values[colour]);
    }
  });

  it('rejects two colours in a row', () => {
    expect(() => run(cfg, [pot('red'), pot('black'), pot('black')])).toThrow('A red must be potted first.');
  });

  it('rejects a red straight after a red', () => {
    expect(() => run(cfg, [pot('red'), pot('red')])).toThrow('A colour must be played after a red.');
  });

  it('counts further reds that fall in the same stroke', () => {
    const state = run(cfg, [pot('red'), extraRed(), extraRed()]);
    expect(points(state, 'p1')).toBe(3);
    expect(state.redsRemaining).toBe(12);
    expect(state.phase).toBe('colour');
    expect(state.stats.p1.redsPotted).toBe(3);

    const next = run(cfg, [pot('blue')], state);
    expect(next.phase).toBe('red');
    expect(points(next, 'p1')).toBe(8);
  });

  it('only accepts a same-stroke red straight after a red, while reds remain', () => {
    // After a "foul and a miss" replay the earlier red is no longer the same stroke.
    const replayed = run(cfg, [pot('red'), foul(7, { after: 'replace', declaredOn: 'black' })]);
    expect(replayed.phase).toBe('colour');
    expect(() => run(cfg, [extraRed()], replayed)).toThrow('A colour must be played after a red.');
    // With the last red gone there is nothing left to fall in.
    const lastRed = run(cfg, [...redsWith('blue', 14), pot('red')]);
    expect(() => run(cfg, [extraRed()], lastRed)).toThrow('A colour must be played after a red.');
  });

  it('re-spots colours while reds remain', () => {
    const state = run(cfg, redsWith('black', 5));
    expect(state.colours).toEqual(COLOUR_ORDER);
    expect(points(state, 'p1')).toBe(40);
    expect(state.redsRemaining).toBe(10);
    // After the next red every colour is available again, including the black.
    const onColour = run(cfg, [pot('red')], state);
    const availability = allAvailability(onColour, cfg);
    for (const colour of COLOUR_ORDER) expect(availability[colour]).toBe('on');
    expect(availability.red).toBe('off');
  });

  it('shows only the red as playable when a red is on', () => {
    const availability = allAvailability(createFrame(cfg, 'p1'), cfg);
    expect(availability.red).toBe('on');
    for (const colour of COLOUR_ORDER) expect(availability[colour]).toBe('off');
  });

  it('ends the visit on a miss and puts the next player on a red', () => {
    const state = run(cfg, [pot('red'), pot('pink'), pot('red'), miss()]);
    expect(state.strikerId).toBe('p2');
    expect(state.phase).toBe('red');
    expect(state.currentBreak).toBe(0);
    expect(state.breakBalls).toEqual([]);
    expect(points(state, 'p1')).toBe(8);
    expect(state.stats.p1.breaks).toEqual([8]);
    expect(state.stats.p1.highestBreak).toBe(8);
    expect(state.stats.p2.visits).toBe(1);
  });

  it('tracks the current break and the trail of balls', () => {
    const state = run(cfg, [pot('red'), pot('black'), pot('red'), pot('blue')]);
    expect(state.currentBreak).toBe(14);
    expect(state.breakBalls).toEqual(['red', 'black', 'red', 'blue']);
    expect(state.stats.p1.highestBreak).toBe(14);
  });
});

describe('colour clearance', () => {
  const allReds = redsWith('blue', 14);

  it('allows a free choice of colour after the last red', () => {
    const state = run(cfg, [...allReds, pot('red')]);
    expect(state.redsRemaining).toBe(0);
    expect(state.phase).toBe('colour');
    expect(pointsRemaining(state)).toBe(7 + 27);
    const next = run(cfg, [pot('pink')], state);
    expect(next.phase).toBe('clearance');
    expect(next.colours).toEqual(COLOUR_ORDER);
    expect(ballOnInfo(next).ball).toBe('yellow');
    expect(pointsRemaining(next)).toBe(27);
  });

  it('goes straight to the yellow when the colour after the last red is missed', () => {
    const state = run(cfg, [...allReds, pot('red'), miss()]);
    expect(state.strikerId).toBe('p2');
    expect(state.phase).toBe('clearance');
    expect(ballOnInfo(state).ball).toBe('yellow');
    expect(() => run(cfg, [pot('black')], state)).toThrow('The yellow must be potted next.');
  });

  it('requires yellow, green, brown, blue, pink, black in order', () => {
    let state = run(cfg, [...allReds, pot('red'), pot('black')]);
    for (let i = 0; i < COLOUR_ORDER.length; i++) {
      const on = COLOUR_ORDER[i];
      for (const other of COLOUR_ORDER) {
        if (other === on) continue;
        expect(() => run(cfg, [pot(other)], state)).toThrow(RuleError);
      }
      expect(() => run(cfg, [pot('red')], state)).toThrow('There are no reds left on the table.');
      state = run(cfg, [pot(on)], state);
    }
    expect(state.phase).toBe('over');
  });

  it('does not re-spot colours in the clearance', () => {
    const state = run(cfg, [...allReds, pot('red'), pot('black'), pot('yellow'), pot('green')]);
    expect(state.colours).toEqual(['brown', 'blue', 'pink', 'black']);
    const availability = allAvailability(state, cfg);
    expect(availability.red).toBe('gone');
    expect(availability.yellow).toBe('gone');
    expect(availability.green).toBe('gone');
    expect(availability.brown).toBe('on');
    expect(availability.blue).toBe('off');
    expect(() => run(cfg, [pot('yellow')], state)).toThrow('The yellow has already been potted.');
    expect(pointsRemaining(state)).toBe(4 + 5 + 6 + 7);
  });

  it('ends the frame when the final black is potted', () => {
    const state = run(cfg, [...allReds, pot('red'), pot('black'), ...CLEARANCE]);
    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('p1');
    expect(state.endReason).toBe('cleared');
    expect(pointsRemaining(state)).toBe(0);
    expect(() => run(cfg, [pot('black')], state)).toThrow('The frame is over.');
    expect(() => run(cfg, [miss()], state)).toThrow('The frame is over.');
  });
});

describe('maximum break', () => {
  it('recognises a 147: fifteen reds with blacks, then all the colours', () => {
    const events = [...redsWith('black', 15), ...CLEARANCE];
    expect(events).toHaveLength(36);

    const beforeBlack = run(cfg, events.slice(0, -1));
    expect(beforeBlack.currentBreak).toBe(140);
    expect(beforeBlack.maximumBy).toBeNull();

    const state = run(cfg, events);
    expect(points(state, 'p1')).toBe(147);
    expect(state.stats.p1.highestBreak).toBe(147);
    expect(state.stats.p1.breaks).toEqual([147]);
    expect(state.stats.p1.redsPotted).toBe(15);
    expect(state.stats.p1.coloursPotted).toBe(21);
    expect(state.maximumBy).toBe('p1');
    expect(state.winnerId).toBe('p1');
    expect(points(state, 'p2')).toBe(0);
  });

  it('counts down the points remaining through a maximum', () => {
    let state = createFrame(cfg, 'p1');
    let scored = 0;
    for (const event of [...redsWith('black', 15), ...CLEARANCE]) {
      state = run(cfg, [event], state);
      scored = points(state, 'p1');
      expect(scored + pointsRemaining(state)).toBe(147);
    }
    expect(scored).toBe(147);
  });

  it('allows a maximum by the player who did not break off', () => {
    const state = run(cfg, [miss(), ...redsWith('black', 15), ...CLEARANCE]);
    expect(state.maximumBy).toBe('p2');
    expect(state.winnerId).toBe('p2');
  });

  it('does not call a total clearance a 147 when lower colours were taken', () => {
    const state = run(cfg, [...redsWith('black', 14), pot('red'), pot('pink'), ...CLEARANCE]);
    expect(points(state, 'p1')).toBe(146);
    expect(state.maximumBy).toBeNull();
  });

  it('does not flag a maximum in a short (10-red) frame', () => {
    const short = makeConfig(2, { totalReds: 10 });
    const state = run(short, [...redsWith('black', 10), ...CLEARANCE]);
    expect(points(state, 'p1')).toBe(107);
    expect(state.maximumBy).toBeNull();
  });

  it('scores a 155 from a free ball without calling it a 147', () => {
    const events: FrameEvent[] = [
      foul(4, { freeBall: true }), // p1 fouls on the break-off and leaves a snooker
      freeBall('black'), // p2 nominates a colour as a red: 1
      pot('black'), // 7
      ...redsWith('black', 15), // 120
      ...CLEARANCE, // 27
    ];
    const state = run(cfg, events);
    expect(state.stats.p2.highestBreak).toBe(155);
    expect(points(state, 'p2')).toBe(159); // 155 plus the 4 penalty points
    expect(state.maximumBy).toBeNull();
    expect(state.winnerId).toBe('p2');
  });
});

describe('a complete two-player frame', () => {
  it('produces the right scores, breaks and statistics', () => {
    const events: FrameEvent[] = [
      miss(), // 1. A breaks off
      pot('red'), pot('black'), pot('red'), pot('pink'), miss(), // 2. B makes 15
      pot('red'), pot('blue'), pot('red'), pot('black'), pot('red'), miss(), // 3. A makes 15
      foul(5, { kind: 'wrongBall', ballInvolved: 'blue' }), // 4. B hits the blue: 5 to A
      ...redsWith('black', 3), pot('red'), pot('pink'), miss(), // 5. A makes 31
      pot('red'), pot('yellow'), pot('red'), pot('green'), miss(), // 6. B makes 7
      miss(), // 7. A plays safe
      ...redsWith('black', 2), pot('red'), pot('blue'), miss(), // 8. B makes 22
      pot('red'), pot('brown'), pot('yellow'), pot('green'), miss(), // 9. A makes 10
      pot('brown'), pot('blue'), pot('pink'), pot('black'), // 10. B clears up: 22
    ];
    const state = run(cfg, events);

    expect(state.phase).toBe('over');
    expect(points(state, 'p1')).toBe(61);
    expect(points(state, 'p2')).toBe(66);
    expect(state.winnerId).toBe('p2');
    expect(state.endReason).toBe('cleared');
    expect(state.redsRemaining).toBe(0);

    const a = state.stats.p1;
    expect(a.breaks).toEqual([15, 31, 10]);
    expect(a.highestBreak).toBe(31);
    expect(a.redsPotted).toBe(8);
    expect(a.coloursPotted).toBe(9);
    expect(a.pointsFromPots).toBe(56);
    expect(a.pointsFromFouls).toBe(5);
    expect(a.foulsCommitted).toBe(0);
    expect(a.visits).toBe(5);

    const b = state.stats.p2;
    expect(b.breaks).toEqual([15, 7, 22, 22]);
    expect(b.highestBreak).toBe(22);
    expect(b.redsPotted).toBe(7);
    expect(b.coloursPotted).toBe(11);
    expect(b.pointsFromPots).toBe(66);
    expect(b.foulsCommitted).toBe(1);
    expect(b.foulPointsConceded).toBe(5);
    expect(b.visits).toBe(5);

    expect(a.redsPotted + b.redsPotted).toBe(15);
  });

  it('reports points remaining at each stage of a frame', () => {
    let state = run(cfg, [miss(), pot('red'), pot('black'), pot('red'), pot('pink'), miss()]);
    expect(state.redsRemaining).toBe(13);
    expect(pointsRemaining(state)).toBe(13 * 8 + 27);
    state = run(cfg, [pot('red')], state);
    // A red has gone but the colour that follows it is still to come.
    expect(pointsRemaining(state)).toBe(12 * 8 + 7 + 27);
  });
});
