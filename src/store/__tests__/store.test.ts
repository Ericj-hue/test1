import { describe, expect, it } from 'vitest';

import { CLEARANCE, foul, freeBall, miss, pot, redsWith } from '../../engine/__tests__/helpers';
import { currentFrame, liveState, matchStanding, type FrameEvent, type Match } from '../../engine';
import { createAppStore } from '../appStore';
import { finishedMatches, unfinishedMatches } from '../logic';
import { createMemoryStorage, KEYS, loadAppData, sanitiseMatch, type KeyValueStorage } from '../persistence';
import type { NewMatchInput } from '../types';

function setup(names: string[], overrides: Partial<NewMatchInput> = {}): NewMatchInput {
  return {
    players: names.map((name) => ({ name, profileId: null })),
    bestOf: 3,
    totalReds: 15,
    foulDistribution: 'next',
    ...overrides,
  };
}

/** A store on top of the given storage, with predictable ids and clock. */
async function openApp(storage: KeyValueStorage) {
  let tick = 1000;
  let sequence = 0;
  const store = createAppStore(storage, {
    now: () => (tick += 1),
    makeId: (prefix = '') => `${prefix}${(sequence += 1)}_${tick}`,
  });
  await store.getState().hydrate();
  return store;
}

function startOrFail(store: Awaited<ReturnType<typeof openApp>>, input: NewMatchInput): string {
  const result = store.getState().startMatch(input);
  if (!result.ok) throw new Error(result.error);
  return result.matchId;
}

function getMatch(store: Awaited<ReturnType<typeof openApp>>, id: string): Match {
  const match = store.getState().matches.find((m) => m.id === id);
  if (!match) throw new Error('match not found');
  return match;
}

function recordAll(store: Awaited<ReturnType<typeof openApp>>, id: string, events: FrameEvent[]): void {
  for (const event of events) {
    const result = store.getState().record(id, event);
    if (!result.ok) throw new Error(result.error);
  }
}

describe('starting a match', () => {
  it('creates saved player profiles for new names and reuses existing ones', async () => {
    const store = await openApp(createMemoryStorage());
    const first = startOrFail(store, setup(['Ann', 'Bob']));
    expect(store.getState().profiles.map((p) => p.name)).toEqual(['Ann', 'Bob']);

    const second = startOrFail(store, setup(['  bob ', 'Cy', 'ANN']));
    const profiles = store.getState().profiles;
    expect(profiles.map((p) => p.name)).toEqual(['Ann', 'Bob', 'Cy']);

    const players = getMatch(store, second).config.players;
    expect(players.map((p) => p.name)).toEqual(['Bob', 'Cy', 'Ann']);
    expect(players[0].profileId).toBe(profiles[1].id);
    expect(players[2].profileId).toBe(profiles[0].id);
    expect(getMatch(store, second).config.mode).toBe('multiplayer');
    expect(getMatch(store, first).config.mode).toBe('standard');
  });

  it('reports an invalid set-up instead of starting', async () => {
    const store = await openApp(createMemoryStorage());
    expect(store.getState().startMatch(setup(['Ann']))).toEqual({ ok: false, error: 'Add at least two players.' });
    expect(store.getState().startMatch(setup(['Ann', '']))).toEqual({
      ok: false,
      error: 'Every player needs a name.',
    });
    expect(store.getState().startMatch(setup(['Ann', 'ann']))).toEqual({
      ok: false,
      error: 'The same player has been added twice.',
    });
    expect(store.getState().matches).toHaveLength(0);
  });

  it('remembers the last set-up for next time', async () => {
    const store = await openApp(createMemoryStorage());
    startOrFail(store, setup(['Ann', 'Bob', 'Cy'], { bestOf: 7, foulDistribution: 'all' }));
    expect(store.getState().settings.lastSetup).toEqual({
      names: ['Ann', 'Bob', 'Cy'],
      bestOf: 7,
      totalReds: 15,
      foulDistribution: 'all',
    });
  });
});

describe('scoring through the store', () => {
  it('returns the rule that was broken and changes nothing', async () => {
    const store = await openApp(createMemoryStorage());
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    const before = getMatch(store, id);
    expect(store.getState().record(id, pot('black'))).toEqual({ ok: false, error: 'A red must be potted first.' });
    expect(getMatch(store, id)).toBe(before);
  });

  it('undo and restart work on the live frame', async () => {
    const store = await openApp(createMemoryStorage());
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    recordAll(store, id, [pot('red'), pot('black'), pot('red')]);
    store.getState().undo(id);
    expect(liveState(getMatch(store, id))!.currentBreak).toBe(8);
    store.getState().restartFrame(id);
    expect(currentFrame(getMatch(store, id))!.events).toEqual([]);
    store.getState().undo(id); // nothing to undo: no error
    expect(currentFrame(getMatch(store, id))!.events).toEqual([]);
  });
});

describe('saving and resuming', () => {
  it('saves after every scoring action', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    const script = [pot('red'), pot('black'), miss(), foul(4)];
    for (let i = 0; i < script.length; i++) {
      recordAll(store, id, [script[i]]);
      await store.getState().flush();
      const saved = JSON.parse(storage.dump()[KEYS.match(id)]) as Match;
      expect(saved.frames[0].events).toHaveLength(i + 1);
    }
  });

  it('restores an unfinished match exactly after the app is closed and reopened', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const id = startOrFail(store, setup(['Ann', 'Bob'], { bestOf: 5 }));

    // Frame 1 is completed, frame 2 is left mid-break with a free ball pending.
    recordAll(store, id, [...redsWith('black', 15), ...CLEARANCE]);
    expect(store.getState().nextFrame(id, 'p2')).toEqual({ ok: true });
    recordAll(store, id, [
      pot('red'), pot('blue'), miss(),
      foul(5, { ballInvolved: 'blue', freeBall: true }),
      freeBall('pink'), pot('black'), pot('red'),
    ]);
    const before = getMatch(store, id);
    const stateBefore = liveState(before)!;
    await store.getState().flush();

    // "Restart the phone": a brand-new store reading the same storage.
    const reopened = await openApp(createMemoryStorage(storage.dump()));
    const after = getMatch(reopened, id);
    expect(after).toEqual(before);
    expect(after.status).toBe('active');
    expect(liveState(after)).toEqual(stateBefore);
    expect(liveState(after)!.strikerId).toBe('p2');
    expect(liveState(after)!.currentBreak).toBe(9);
    expect(liveState(after)!.phase).toBe('colour');
    expect(matchStanding(after).wins).toEqual({ p1: 1, p2: 0 });
    expect(unfinishedMatches(reopened.getState())).toHaveLength(1);

    // Play simply carries on, and undo still works across the restart.
    recordAll(reopened, id, [pot('pink')]);
    expect(liveState(getMatch(reopened, id))!.currentBreak).toBe(15);
    reopened.getState().undo(id);
    reopened.getState().undo(id);
    expect(liveState(getMatch(reopened, id))!.currentBreak).toBe(8);
  });

  it('keeps several unfinished matches side by side', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const first = startOrFail(store, setup(['Ann', 'Bob']));
    const second = startOrFail(store, setup(['Cy', 'Di', 'Ed']));
    recordAll(store, first, [pot('red')]);
    recordAll(store, second, [miss(), pot('red'), pot('pink')]);
    await store.getState().flush();

    const reopened = await openApp(createMemoryStorage(storage.dump()));
    expect(unfinishedMatches(reopened.getState()).map((m) => m.id).sort()).toEqual([first, second].sort());
    expect(liveState(getMatch(reopened, first))!.stats.p1.points).toBe(1);
    expect(liveState(getMatch(reopened, second))!.stats.p2.points).toBe(7);
  });

  it('files a completed match in the history and restores it', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const id = startOrFail(store, setup(['Ann', 'Bob'], { bestOf: 1 }));
    recordAll(store, id, [...redsWith('black', 15), ...CLEARANCE]);
    store.getState().finishMatch(id);
    await store.getState().flush();

    const reopened = await openApp(createMemoryStorage(storage.dump()));
    const history = finishedMatches(reopened.getState());
    expect(history).toHaveLength(1);
    expect(history[0].winnerIds).toEqual(['p1']);
    expect(history[0].frames[0].result!.stats.p1.points).toBe(147);
    expect(history[0].frames[0].events).toEqual([]);
    expect(unfinishedMatches(reopened.getState())).toHaveLength(0);
  });

  it('removes deleted matches from storage', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    await store.getState().flush();
    expect(storage.dump()[KEYS.match(id)]).toBeDefined();
    store.getState().deleteMatch(id);
    await store.getState().flush();
    expect(storage.dump()[KEYS.match(id)]).toBeUndefined();
  });

  it('drops a match that is ended before any frame was completed', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    recordAll(store, id, [pot('red')]);
    store.getState().finishMatch(id);
    await store.getState().flush();
    expect(store.getState().matches).toHaveLength(0);
    expect(storage.dump()[KEYS.match(id)]).toBeUndefined();
  });

  it('saves settings and player profiles', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    store.getState().updateSettings({ sound: false, theme: 'midnight' });
    const added = store.getState().addProfile('  Ronnie  ');
    expect(added.ok).toBe(true);
    await store.getState().flush();

    const reopened = await openApp(createMemoryStorage(storage.dump()));
    expect(reopened.getState().settings.sound).toBe(false);
    expect(reopened.getState().settings.theme).toBe('midnight');
    expect(reopened.getState().settings.haptics).toBe(true);
    expect(reopened.getState().profiles.map((p) => p.name)).toEqual(['Ronnie']);
  });

  it('survives rapid scoring: only the latest state is kept', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    recordAll(store, id, redsWith('black', 15)); // 30 saves queued back to back
    await store.getState().flush();
    const saved = JSON.parse(storage.dump()[KEYS.match(id)]) as Match;
    expect(saved.frames[0].events).toHaveLength(30);
  });
});

describe('damaged or missing data', () => {
  it('starts cleanly on first launch', async () => {
    const store = await openApp(createMemoryStorage());
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().matches).toEqual([]);
    expect(store.getState().profiles).toEqual([]);
    expect(store.getState().settings.theme).toBe('baize');
  });

  it('ignores records that cannot be read rather than crashing', async () => {
    const good = createMemoryStorage();
    const first = await openApp(good);
    const id = startOrFail(first, setup(['Ann', 'Bob']));
    recordAll(first, id, [pot('red'), pot('black')]);
    await first.getState().flush();

    const data = await loadAppData(
      createMemoryStorage({
        ...good.dump(),
        [KEYS.settings]: '{not json',
        [KEYS.match('broken')]: '{"id":"broken"}',
        [KEYS.match('empty')]: '',
        'some-other-app/key': 'ignored',
      }),
    );
    expect(data.settings.sound).toBe(true);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].id).toBe(id);
  });

  it('skips corrupt events inside a saved frame', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    recordAll(store, id, [pot('red'), pot('black')]);
    await store.getState().flush();

    const saved = JSON.parse(storage.dump()[KEYS.match(id)]);
    saved.frames[0].events.splice(1, 0, { type: 'pot', ball: 'red' }, 'garbage', { type: 'nonsense' }, null);
    const match = sanitiseMatch(saved)!;
    // The illegal red-after-red and the junk entries are ignored; the real shots still count.
    expect(liveState(match)!.stats.p1.points).toBe(8);
  });

  it('keeps working if storage refuses to write', async () => {
    const failing: KeyValueStorage = {
      ...createMemoryStorage(),
      async setItem() {
        throw new Error('Storage is full');
      },
    };
    const store = await openApp(failing);
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    recordAll(store, id, [pot('red')]);
    await store.getState().flush();
    expect(store.getState().storageError).toBe('Storage is full');
    expect(liveState(getMatch(store, id))!.stats.p1.points).toBe(1);
  });
});

describe('player profiles', () => {
  it('renames a player in their profile and in saved matches', async () => {
    const store = await openApp(createMemoryStorage());
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    const ann = store.getState().profiles[0];
    expect(store.getState().renameProfile(ann.id, 'Annie')).toEqual({ ok: true });
    expect(store.getState().profiles[0].name).toBe('Annie');
    expect(getMatch(store, id).config.players[0].name).toBe('Annie');
    expect(store.getState().renameProfile(ann.id, 'bob')).toEqual({
      ok: false,
      error: 'There is already a player called "bob".',
    });
    expect(store.getState().renameProfile(ann.id, '   ')).toEqual({ ok: false, error: 'Enter a name.' });
  });

  it('refuses duplicate names when adding', async () => {
    const store = await openApp(createMemoryStorage());
    expect(store.getState().addProfile('Ann').ok).toBe(true);
    expect(store.getState().addProfile('ann')).toEqual({
      ok: false,
      error: 'There is already a player called "ann".',
    });
  });

  it('deleting a profile keeps the match but unlinks the player', async () => {
    const store = await openApp(createMemoryStorage());
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    const ann = store.getState().profiles[0];
    store.getState().deleteProfile(ann.id);
    expect(store.getState().profiles.map((p) => p.name)).toEqual(['Bob']);
    const players = getMatch(store, id).config.players;
    expect(players[0].name).toBe('Ann');
    expect(players[0].profileId).toBeNull();
  });

  it('clearing all data wipes storage too', async () => {
    const storage = createMemoryStorage();
    const store = await openApp(storage);
    const id = startOrFail(store, setup(['Ann', 'Bob']));
    await store.getState().flush();
    store.getState().clearAllData();
    await store.getState().flush();
    expect(storage.dump()[KEYS.match(id)]).toBeUndefined();
    const reopened = await openApp(createMemoryStorage(storage.dump()));
    expect(reopened.getState().matches).toEqual([]);
    expect(reopened.getState().profiles).toEqual([]);
  });
});
