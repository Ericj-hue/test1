import { describe, expect, it } from 'vitest';

import { createFrame, foulRecipients } from '../frame';
import { rankedPlayers, snookersRequired } from '../selectors';
import type { FrameEvent, FrameState } from '../types';
import { adjust, CLEARANCE, foul, makeConfig, miss, points, pot, redsWith, run } from './helpers';

const ids = (count: number) => Array.from({ length: count }, (_, i) => `p${i + 1}`);

describe.each([3, 4, 5, 10])('%i-player rotation', (count) => {
  const cfg = makeConfig(count);
  const players = ids(count);

  it('uses multiplayer mode with next-player foul points by default', () => {
    expect(cfg.mode).toBe('multiplayer');
    expect(cfg.foulDistribution).toBe('next');
    expect(cfg.players).toHaveLength(count);
  });

  it('rotates through every player in order and wraps round', () => {
    let state = createFrame(cfg, 'p1');
    const seen: string[] = [state.strikerId];
    for (let turn = 0; turn < count * 2; turn++) {
      state = run(cfg, [miss()], state);
      seen.push(state.strikerId);
    }
    expect(seen).toEqual([...players, ...players, 'p1']);
    // Everyone has now had two visits, and p1 is on a third.
    for (const id of players) expect(state.stats[id].visits).toBe(id === 'p1' ? 3 : 2);
  });

  it('keeps a player at the table for as long as they score', () => {
    const state = run(cfg, [miss(), ...redsWith('black', 3), pot('red')]);
    expect(state.strikerId).toBe('p2');
    expect(state.currentBreak).toBe(25);
    expect(run(cfg, [miss()], state).strikerId).toBe('p3');
  });

  it('gives foul points to the next player, who then comes to the table', () => {
    const state = run(cfg, [foul(5, { ballInvolved: 'blue' })]);
    expect(points(state, 'p2')).toBe(5);
    expect(state.strikerId).toBe('p2');
    for (const id of players) if (id !== 'p2') expect(points(state, id)).toBe(0);
    expect(state.stats.p1.foulsCommitted).toBe(1);
    expect(state.stats.p1.foulPointsConceded).toBe(5);
  });

  it('wraps round so the last player fouls to the first', () => {
    const lastPlayer = players[count - 1];
    const toLast: FrameEvent[] = Array.from({ length: count - 1 }, () => miss());
    const state = run(cfg, [...toLast, foul(4)]);
    expect(state.stats[lastPlayer].foulsCommitted).toBe(1);
    expect(points(state, 'p1')).toBe(4);
    expect(state.strikerId).toBe('p1');
  });

  it('tracks every player individually', () => {
    // Each player in turn pots a red and a colour, then misses.
    const colours = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'] as const;
    const events: FrameEvent[] = [];
    players.forEach((_, index) => {
      events.push(pot('red'), pot(colours[index % colours.length]), miss());
    });
    const state = run(cfg, events);
    players.forEach((id, index) => {
      const expected = 1 + (2 + (index % colours.length));
      expect(points(state, id)).toBe(expected);
      expect(state.stats[id].highestBreak).toBe(expected);
      expect(state.stats[id].breaks).toEqual([expected]);
      expect(state.stats[id].redsPotted).toBe(1);
      expect(state.stats[id].coloursPotted).toBe(1);
      expect(state.stats[id].foulsCommitted).toBe(0);
    });
    expect(state.redsRemaining).toBe(15 - count);
    expect(state.strikerId).toBe('p1');
  });

  it('awards the frame to the top scorer when the black goes down', () => {
    // p1 misses, p2 clears the table.
    const state = run(cfg, [miss(), ...redsWith('black', 15), ...CLEARANCE]);
    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('p2');
    expect(points(state, 'p2')).toBe(147);
    expect(rankedPlayers(state, cfg)[0]).toBe('p2');
  });
});

describe('multiplayer foul distribution options', () => {
  it('"all other players" gives everyone else the penalty', () => {
    const cfg = makeConfig(5, { foulDistribution: 'all' });
    const state = run(cfg, [miss(), foul(6, { ballInvolved: 'pink' })]); // p2 fouls
    for (const id of ['p1', 'p3', 'p4', 'p5']) expect(points(state, id)).toBe(6);
    expect(points(state, 'p2')).toBe(0);
    expect(state.stats.p2.foulPointsConceded).toBe(24);
    expect(state.stats.p3.pointsFromFouls).toBe(6);
    expect(state.strikerId).toBe('p3');
  });

  it('"manual" gives the penalty to the chosen player only', () => {
    const cfg = makeConfig(4, { foulDistribution: 'manual' });
    const state = run(cfg, [foul(7, { ballInvolved: 'black', recipientId: 'p4' })]);
    expect(points(state, 'p4')).toBe(7);
    expect(points(state, 'p2')).toBe(0);
    expect(points(state, 'p3')).toBe(0);
    // Play still passes to the next player in the rotation.
    expect(state.strikerId).toBe('p2');
  });

  it('"manual" insists on a valid recipient', () => {
    const cfg = makeConfig(4, { foulDistribution: 'manual' });
    expect(() => run(cfg, [foul(4)])).toThrow('Choose which player receives the foul points.');
    expect(() => run(cfg, [foul(4, { recipientId: 'p1' })])).toThrow('Choose which player receives the foul points.');
    expect(() => run(cfg, [foul(4, { recipientId: 'nobody' })])).toThrow(
      'Choose which player receives the foul points.',
    );
  });

  it('reports who would receive a foul before it is recorded', () => {
    const next = makeConfig(4);
    const all = makeConfig(4, { foulDistribution: 'all' });
    const manual = makeConfig(4, { foulDistribution: 'manual' });
    expect(foulRecipients(createFrame(next, 'p1'), next)).toEqual(['p2']);
    expect(foulRecipients(createFrame(next, 'p4'), next)).toEqual(['p1']);
    expect(foulRecipients(createFrame(all, 'p2'), all)).toEqual(['p1', 'p3', 'p4']);
    expect(foulRecipients(createFrame(manual, 'p1'), manual, 'p3')).toEqual(['p3']);
    expect(foulRecipients(createFrame(manual, 'p1'), manual)).toEqual([]);
  });
});

describe('standard two-player mode is unaffected by multiplayer options', () => {
  it('always uses the official rule: penalty to the opponent', () => {
    const cfg = makeConfig(2, { foulDistribution: 'all' });
    expect(cfg.mode).toBe('standard');
    expect(cfg.foulDistribution).toBe('opponent');
    const state = run(cfg, [foul(4, { recipientId: 'p1' })]);
    expect(points(state, 'p2')).toBe(4);
    expect(points(state, 'p1')).toBe(0);
    expect(state.stats.p1.foulPointsConceded).toBe(4);
  });
});

describe('multiplayer tie-breaks', () => {
  const cfg = makeConfig(3, { totalReds: 1 });
  // p1 makes 28 and leaves the black; p2, level after penalties, pots it to tie.
  const toBlack: FrameEvent[] = [
    pot('red'), pot('black'), pot('yellow'), pot('green'), pot('brown'), pot('blue'), pot('pink'),
  ];

  function tiedBetweenFirstTwo(): FrameState {
    return run(cfg, [...toBlack, adjust('p2', 21), adjust('p3', 5), miss(), pot('black')]);
  }

  it('re-spots the black between the level leaders only', () => {
    const state = tiedBetweenFirstTwo();
    expect(points(state, 'p1')).toBe(28);
    expect(points(state, 'p2')).toBe(28);
    expect(points(state, 'p3')).toBe(5);
    expect(state.phase).toBe('respot');
    expect(state.eligibleIds).toEqual(['p1', 'p2']);
    expect(() => run(cfg, [{ type: 'respotBlack', firstPlayerId: 'p3' }], state)).toThrow(
      'That player is not in the tie-break.',
    );
  });

  it('skips players who are out of the tie-break', () => {
    let state = run(cfg, [{ type: 'respotBlack', firstPlayerId: 'p2' }], tiedBetweenFirstTwo());
    expect(state.strikerId).toBe('p2');
    state = run(cfg, [miss()], state);
    expect(state.strikerId).toBe('p1'); // p3 is skipped
    state = run(cfg, [miss()], state);
    expect(state.strikerId).toBe('p2');
    state = run(cfg, [pot('black')], state);
    expect(state.winnerId).toBe('p2');
    expect(points(state, 'p2')).toBe(35);
  });

  it('gives a foul on the re-spotted black to the other player in the tie-break', () => {
    const start = run(cfg, [{ type: 'respotBlack', firstPlayerId: 'p2' }], tiedBetweenFirstTwo());
    const state = run(cfg, [foul(7)], start);
    expect(points(state, 'p1')).toBe(35);
    expect(points(state, 'p3')).toBe(5);
    expect(state.winnerId).toBe('p1');
  });

  it('handles a three-way tie', () => {
    const state = run(cfg, [...toBlack, adjust('p2', 21), adjust('p3', 28), miss(), pot('black')]);
    expect(state.phase).toBe('respot');
    expect(state.eligibleIds).toEqual(['p1', 'p2', 'p3']);
    const decided = run(cfg, [{ type: 'respotBlack', firstPlayerId: 'p3' }, miss(), pot('black')], state);
    expect(decided.winnerId).toBe('p1');
  });
});

describe('snookers required', () => {
  it('is zero while enough points remain', () => {
    const cfg = makeConfig(2);
    const state = run(cfg, [...redsWith('black', 5), miss()]);
    expect(snookersRequired(state, cfg, 'p2')).toBe(0); // 40 behind with 107 left
    expect(snookersRequired(state, cfg, 'p1')).toBe(0);
  });

  it('counts the penalties needed once the deficit exceeds the points left', () => {
    const cfg = makeConfig(2);
    // p1 pots 14 reds with blacks (112); one red left: 8 + 27 = 35 on the table.
    const state = run(cfg, [...redsWith('black', 14), miss()]);
    expect(points(state, 'p1')).toBe(112);
    // 112 behind, 35 available: 77 short at 4 a foul = 20 snookers.
    expect(snookersRequired(state, cfg, 'p2')).toBe(20);
  });

  it('works against the leader in a multiplayer frame', () => {
    const cfg = makeConfig(3);
    const state = run(cfg, [...redsWith('black', 14), miss(), adjust('p2', 80)]);
    expect(snookersRequired(state, cfg, 'p2')).toBe(0); // 32 behind, 35 left
    expect(snookersRequired(state, cfg, 'p3')).toBe(20);
  });
});
