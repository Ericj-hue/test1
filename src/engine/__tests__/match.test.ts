import { describe, expect, it } from 'vitest';

import { replayFrame } from '../frame';
import {
  buildConfig,
  canUndo,
  createMatch,
  currentFrame,
  decideWinners,
  finishMatch,
  liveState,
  matchStanding,
  nextBreakerId,
  recordEvent,
  restartFrame,
  startNextFrame,
  undoLastEvent,
  validateConfig,
} from '../match';
import { careerStats, matchTotals } from '../stats';
import { formatMatchText } from '../summary';
import { RuleError, type FrameEvent, type Match, type MatchPlayer } from '../types';
import { adjust, CLEARANCE, foul, freeBall, makeConfig, miss, pot, redsWith } from './helpers';

const NOW = 1_700_000_000_000;

function playersNamed(...names: string[]): MatchPlayer[] {
  return names.map((name, index) => ({ id: `p${index + 1}`, name, profileId: `profile-${name.toLowerCase()}` }));
}

function record(match: Match, events: FrameEvent[]): Match {
  let next = match;
  events.forEach((event, index) => {
    next = recordEvent(next, event, NOW + index);
  });
  return next;
}

/** Awards the current frame to `winnerId` and moves on (or stops if the match is decided). */
function winFrame(match: Match, winnerId: string, score = 60): Match {
  let next = record(match, [adjust(winnerId, score), { type: 'concede', winnerId }]);
  if (!matchStanding(next).decided) next = startNextFrame(next, nextBreakerId(next), NOW);
  return next;
}

describe('match configuration', () => {
  it('uses the standard rules for two players and rotation for three or more', () => {
    const two = buildConfig({ players: playersNamed('Ann', 'Bob'), bestOf: 5 });
    expect(two.mode).toBe('standard');
    expect(two.foulDistribution).toBe('opponent');
    expect(two.totalReds).toBe(15);
    const three = buildConfig({ players: playersNamed('Ann', 'Bob', 'Cy'), bestOf: 5 });
    expect(three.mode).toBe('multiplayer');
    expect(three.foulDistribution).toBe('next');
    const custom = buildConfig({ players: playersNamed('Ann', 'Bob', 'Cy'), bestOf: 5, foulDistribution: 'all' });
    expect(custom.foulDistribution).toBe('all');
  });

  it('accepts 2 to 10 players and nothing else', () => {
    for (let count = 2; count <= 10; count++) {
      expect(validateConfig(makeConfig(count))).toBeNull();
    }
    expect(validateConfig(makeConfig(1))).toBe('Add at least two players.');
    expect(validateConfig(makeConfig(11))).toBe('A game can have at most 10 players.');
    expect(() => createMatch('m', makeConfig(11), NOW)).toThrow(RuleError);
  });

  it('requires distinct, non-empty names', () => {
    expect(validateConfig(buildConfig({ players: playersNamed('Ann', '  '), bestOf: 1 }))).toBe(
      'Every player needs a name.',
    );
    expect(validateConfig(buildConfig({ players: playersNamed('Ann', 'ann'), bestOf: 1 }))).toContain(
      'Give each player a different name.',
    );
  });

  it('validates the number of frames and reds', () => {
    expect(validateConfig(makeConfig(2, { bestOf: 0 }))).toBe('Choose between 1 and 99 frames.');
    expect(validateConfig(makeConfig(2, { bestOf: 100 }))).toBe('Choose between 1 and 99 frames.');
    expect(validateConfig(makeConfig(2, { bestOf: 2.5 }))).toBe('Choose between 1 and 99 frames.');
    expect(validateConfig(makeConfig(2, { totalReds: 0 }))).toBe('A frame starts with between 1 and 15 reds.');
    expect(validateConfig(makeConfig(2, { totalReds: 16 }))).toBe('A frame starts with between 1 and 15 reds.');
    for (const bestOf of [1, 3, 5, 7, 9, 11, 35]) expect(validateConfig(makeConfig(2, { bestOf }))).toBeNull();
  });
});

describe('recording and undoing', () => {
  it('stamps each event and updates the live frame', () => {
    const match = record(createMatch('m', makeConfig(2), NOW), [pot('red'), pot('black')]);
    const frame = currentFrame(match)!;
    expect(frame.events).toHaveLength(2);
    expect(frame.events[0].at).toBe(NOW);
    expect(liveState(match)!.currentBreak).toBe(8);
    expect(match.updatedAt).toBe(NOW + 1);
  });

  it('refuses illegal events and leaves the match untouched', () => {
    const match = createMatch('m', makeConfig(2), NOW);
    expect(() => recordEvent(match, pot('black'), NOW)).toThrow('A red must be potted first.');
    expect(currentFrame(match)!.events).toHaveLength(0);
  });

  it('undo returns exactly to the previous position, at every point of a frame', () => {
    const cfg = makeConfig(2);
    const script: FrameEvent[] = [
      miss(),
      pot('red'), pot('black'), pot('red'), pot('pink'), miss(),
      foul(5, { kind: 'wrongBall', ballInvolved: 'blue', freeBall: true }),
      freeBall('green'), pot('blue'),
      pot('red'), { type: 'pot', ball: 'red', sameStroke: true }, pot('black'), miss(),
      adjust('p1', 3),
      foul(4, { after: 'replace' }),
      foul(4, { after: 'playAgain', redsLost: 1 }),
      { type: 'setReds', reds: 2 },
      { type: 'setStriker', playerId: 'p2' },
      pot('red'), pot('yellow'), pot('red'), pot('black'),
      ...CLEARANCE,
    ];
    let match = createMatch('m', cfg, NOW);
    for (const event of script) {
      const before = liveState(match)!;
      const after = recordEvent(match, event, NOW);
      expect(canUndo(after)).toBe(true);
      const undone = undoLastEvent(after, NOW);
      expect(liveState(undone)).toEqual(before);
      expect(currentFrame(undone)!.events).toEqual(currentFrame(match)!.events);
      match = after;
    }
    expect(liveState(match)!.phase).toBe('over');
    // Undoing the frame-winning black re-opens the frame.
    const reopened = undoLastEvent(match, NOW);
    expect(liveState(reopened)!.phase).toBe('clearance');
    expect(liveState(reopened)!.winnerId).toBeNull();
  });

  it('undo can be repeated all the way back to the break-off', () => {
    let match = record(createMatch('m', makeConfig(2), NOW), [pot('red'), pot('blue'), miss(), foul(4)]);
    for (let i = 0; i < 4; i++) match = undoLastEvent(match, NOW);
    expect(canUndo(match)).toBe(false);
    expect(liveState(match)).toEqual(replayFrame(match.config, 'p1', []));
    expect(undoLastEvent(match, NOW)).toBe(match);
  });

  it('restarting a frame clears it but keeps the match score', () => {
    let match = createMatch('m', makeConfig(2, { bestOf: 3 }), NOW);
    match = winFrame(match, 'p1');
    match = record(match, [miss(), pot('red'), pot('black')]);
    match = restartFrame(match, NOW + 99);
    expect(currentFrame(match)!.events).toEqual([]);
    expect(currentFrame(match)!.number).toBe(2);
    expect(liveState(match)!.stats.p2.points).toBe(0);
    expect(matchStanding(match).wins).toEqual({ p1: 1, p2: 0 });
  });
});

describe('frames and match score', () => {
  it('counts a finished frame before the next one starts', () => {
    const match = record(createMatch('m', makeConfig(2, { bestOf: 3 }), NOW), [
      ...redsWith('black', 15),
      ...CLEARANCE,
    ]);
    const standing = matchStanding(match);
    expect(standing.wins).toEqual({ p1: 1, p2: 0 });
    expect(standing.points).toEqual({ p1: 147, p2: 0 });
    expect(standing.framesCompleted).toBe(1);
    expect(standing.framesRemaining).toBe(2);
    expect(standing.target).toBe(2);
    expect(standing.decided).toBe(false);
  });

  it('will not start a new frame until the current one is finished', () => {
    const match = record(createMatch('m', makeConfig(2, { bestOf: 3 }), NOW), [pot('red')]);
    expect(() => startNextFrame(match, 'p2', NOW)).toThrow('The current frame is not finished.');
  });

  it('rotates the break-off from frame to frame', () => {
    let match = createMatch('m', makeConfig(3, { bestOf: 9 }), NOW);
    const breakers = [currentFrame(match)!.breakerId];
    for (let i = 0; i < 4; i++) {
      match = winFrame(match, ['p1', 'p2', 'p3'][i % 3]);
      breakers.push(currentFrame(match)!.breakerId);
    }
    expect(breakers).toEqual(['p1', 'p2', 'p3', 'p1', 'p2']);
    expect(liveState(match)!.strikerId).toBe('p2');
  });

  it.each([
    [1, 1],
    [3, 2],
    [5, 3],
    [7, 4],
    [9, 5],
    [11, 6],
    [35, 18],
  ])('best of %i is won with %i frames', (bestOf, target) => {
    let match = createMatch('m', makeConfig(2, { bestOf }), NOW);
    expect(matchStanding(match).target).toBe(target);
    for (let frame = 1; frame <= target; frame++) {
      expect(matchStanding(match).decided).toBe(false);
      match = winFrame(match, 'p1');
    }
    const standing = matchStanding(match);
    expect(standing.decided).toBe(true);
    expect(standing.wins.p1).toBe(target);
    expect(match.frames).toHaveLength(target);
    expect(() => startNextFrame(match, 'p2', NOW)).toThrow('The match is already decided.');
    const finished = finishMatch(match, NOW);
    expect(finished.status).toBe('finished');
    expect(finished.winnerIds).toEqual(['p1']);
  });

  it('goes to a deciding frame when the players are level', () => {
    let match = createMatch('m', makeConfig(2, { bestOf: 5 }), NOW);
    match = winFrame(match, 'p1');
    match = winFrame(match, 'p2');
    match = winFrame(match, 'p2');
    match = winFrame(match, 'p1');
    expect(matchStanding(match).wins).toEqual({ p1: 2, p2: 2 });
    expect(matchStanding(match).decided).toBe(false);
    expect(currentFrame(match)!.number).toBe(5);
    match = winFrame(match, 'p2');
    expect(matchStanding(match).decided).toBe(true);
    expect(finishMatch(match, NOW).winnerIds).toEqual(['p2']);
  });

  it('finishing strips the event logs but keeps every frame result', () => {
    let match = createMatch('m', makeConfig(2, { bestOf: 3 }), NOW);
    match = record(match, [...redsWith('black', 15), ...CLEARANCE]);
    match = startNextFrame(match, 'p2', NOW);
    match = winFrame(match, 'p1');
    const finished = finishMatch(match, NOW + 5);
    expect(finished.status).toBe('finished');
    expect(finished.finishedAt).toBe(NOW + 5);
    expect(finished.frames).toHaveLength(2);
    for (const frame of finished.frames) {
      expect(frame.events).toEqual([]);
      expect(frame.result).not.toBeNull();
    }
    expect(finished.frames[0].result!.stats.p1.points).toBe(147);
    expect(finished.frames[0].result!.maximumBy).toBe('p1');
    expect(liveState(finished)).toBeNull();
    expect(() => recordEvent(finished, pot('red'), NOW)).toThrow('This match has finished.');
    expect(matchStanding(finished).wins).toEqual({ p1: 2, p2: 0 });
    // Finishing twice changes nothing.
    expect(finishMatch(finished, NOW + 9)).toBe(finished);
  });

  it('discards a frame that is still in progress when the match is ended early', () => {
    let match = createMatch('m', makeConfig(2, { bestOf: 5 }), NOW);
    match = winFrame(match, 'p2');
    match = record(match, [pot('red'), pot('black')]);
    const finished = finishMatch(match, NOW);
    expect(finished.frames).toHaveLength(1);
    expect(finished.winnerIds).toEqual(['p2']);
  });

  it('has no winner if the match is ended before any frame is completed', () => {
    const match = record(createMatch('m', makeConfig(2), NOW), [pot('red')]);
    const finished = finishMatch(match, NOW);
    expect(finished.frames).toEqual([]);
    expect(finished.winnerIds).toEqual([]);
    expect(decideWinners(finished)).toEqual([]);
  });
});

describe('multiplayer match results', () => {
  it('is decided early once the leader cannot be caught', () => {
    let match = createMatch('m', makeConfig(4, { bestOf: 5 }), NOW);
    match = winFrame(match, 'p3');
    match = winFrame(match, 'p1');
    match = winFrame(match, 'p3');
    // p3 has 2, p1 has 1, two frames left: p1 could still reach 3.
    expect(matchStanding(match).decided).toBe(false);
    match = winFrame(match, 'p3');
    expect(matchStanding(match).decided).toBe(true);
    expect(finishMatch(match, NOW).winnerIds).toEqual(['p3']);
  });

  it('plays every frame when nobody pulls clear, then separates ties on points', () => {
    let match = createMatch('m', makeConfig(3, { bestOf: 3 }), NOW);
    match = winFrame(match, 'p1', 50);
    match = winFrame(match, 'p2', 70);
    expect(matchStanding(match).decided).toBe(false);
    match = winFrame(match, 'p3', 60);
    const standing = matchStanding(match);
    expect(standing.decided).toBe(true);
    expect(standing.wins).toEqual({ p1: 1, p2: 1, p3: 1 });
    expect(standing.leaderIds).toEqual(['p1', 'p2', 'p3']);
    expect(finishMatch(match, NOW).winnerIds).toEqual(['p2']);
  });

  it('declares a draw when frames and points are both level', () => {
    let match = createMatch('m', makeConfig(2, { bestOf: 2 }), NOW);
    match = winFrame(match, 'p1', 64);
    match = winFrame(match, 'p2', 64);
    expect(matchStanding(match).decided).toBe(true);
    expect(finishMatch(match, NOW).winnerIds).toEqual(['p1', 'p2']);
  });
});

describe('statistics and reports', () => {
  function sampleMatch(): Match {
    const config = buildConfig({ players: playersNamed('Ann', 'Bob'), bestOf: 3 });
    let match = createMatch('m1', config, NOW);
    // Frame 1: Ann makes a 147.
    match = record(match, [...redsWith('black', 15), ...CLEARANCE]);
    match = startNextFrame(match, 'p2', NOW);
    // Frame 2: Bob makes 56, Ann fouls twice, Bob is awarded the frame.
    match = record(match, [
      ...redsWith('black', 7), miss(),
      foul(4), miss(),
      foul(6, { ballInvolved: 'pink' }), { type: 'concede', winnerId: 'p2' },
    ]);
    match = startNextFrame(match, 'p1', NOW);
    // Frame 3: Ann makes 104 and Bob concedes.
    match = record(match, [...redsWith('black', 13), { type: 'concede', winnerId: 'p1' }]);
    return match;
  }

  it('adds up totals across the frames of a match', () => {
    const totals = matchTotals(sampleMatch());
    expect(totals.p1.framesPlayed).toBe(3);
    expect(totals.p1.framesWon).toBe(2);
    expect(totals.p1.points).toBe(147 + 0 + 104);
    expect(totals.p1.highestBreak).toBe(147);
    expect(totals.p1.breaks50).toBe(2);
    expect(totals.p1.centuries).toBe(2);
    expect(totals.p1.maximums).toBe(1);
    expect(totals.p1.redsPotted).toBe(28);
    expect(totals.p1.coloursPotted).toBe(21 + 13);
    expect(totals.p1.fouls).toBe(2);
    expect(totals.p1.foulPointsConceded).toBe(10);

    expect(totals.p2.framesWon).toBe(1);
    expect(totals.p2.points).toBe(56 + 10);
    expect(totals.p2.pointsFromFouls).toBe(10);
    expect(totals.p2.highestBreak).toBe(56);
    expect(totals.p2.breaks50).toBe(1);
    expect(totals.p2.centuries).toBe(0);
  });

  it('can include the frame in progress', () => {
    let match = createMatch('m', makeConfig(2, { bestOf: 3 }), NOW);
    match = record(match, [...redsWith('black', 7)]);
    expect(matchTotals(match).p1.points).toBe(0);
    const live = matchTotals(match, true);
    expect(live.p1.points).toBe(56);
    expect(live.p1.highestBreak).toBe(56);
    expect(live.p1.breaks50).toBe(1);
    expect(live.p1.framesWon).toBe(0);
  });

  it('builds career statistics per saved player from finished matches only', () => {
    const finished = finishMatch(sampleMatch(), NOW + 1000);
    const unfinished = createMatch('m2', finished.config, NOW);
    const career = careerStats([finished, unfinished]);
    const ann = career['profile-ann'];
    const bob = career['profile-bob'];
    expect(ann.matchesPlayed).toBe(1);
    expect(ann.matchesWon).toBe(1);
    expect(ann.matchesLost).toBe(0);
    expect(ann.framesWon).toBe(2);
    expect(ann.highestBreak).toBe(147);
    expect(ann.maximums).toBe(1);
    expect(ann.lastPlayedAt).toBe(NOW + 1000);
    expect(bob.matchesPlayed).toBe(1);
    expect(bob.matchesWon).toBe(0);
    expect(bob.matchesLost).toBe(1);
    expect(bob.framesWon).toBe(1);
  });

  it('accumulates career statistics over several matches, including draws', () => {
    const config = buildConfig({ players: playersNamed('Ann', 'Bob'), bestOf: 2 });
    let drawn = createMatch('d', config, NOW);
    drawn = winFrame(drawn, 'p1', 64);
    drawn = winFrame(drawn, 'p2', 64);
    const career = careerStats([finishMatch(sampleMatch(), NOW), finishMatch(drawn, NOW + 5)]);
    expect(career['profile-ann'].matchesPlayed).toBe(2);
    expect(career['profile-ann'].matchesWon).toBe(1);
    expect(career['profile-ann'].matchesDrawn).toBe(1);
    expect(career['profile-bob'].matchesDrawn).toBe(1);
    expect(career['profile-bob'].matchesLost).toBe(1);
    expect(career['profile-ann'].framesPlayed).toBe(5);
  });

  it('writes a shareable text report', () => {
    const text = formatMatchText(finishMatch(sampleMatch(), NOW));
    expect(text).toContain('Snooker - Best of 3');
    expect(text).toContain('Ann 2 - 1 Bob');
    expect(text).toContain('Winner: Ann');
    expect(text).toContain('Frame 1: Ann 147, Bob 0 - won by Ann');
    expect(text).toContain('Frame 2: Ann 0, Bob 66 - won by Bob (frame conceded)');
    expect(text).toContain('Ann: 147 (1 x 147)');
    expect(text).toContain('Bob: 56');
  });

  it('ranks the players in a multiplayer report', () => {
    const config = buildConfig({ players: playersNamed('Ann', 'Bob', 'Cy'), bestOf: 3 });
    let match = createMatch('m', config, NOW);
    match = winFrame(match, 'p3', 40);
    match = winFrame(match, 'p3', 55);
    const text = formatMatchText(finishMatch(match, NOW));
    expect(text).toContain('1. Cy - 2 frames, 95 pts');
    expect(text).toContain('Winner: Cy');
  });
});
