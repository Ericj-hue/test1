/**
 * Offline storage.
 *
 * Data is kept in a simple key-value store (AsyncStorage on Android and iOS,
 * localStorage on the web). Each match lives under its own key so that a save
 * after every shot only rewrites the match being played, and so no single
 * record can grow past platform row-size limits.
 */
import { validateConfig, type FrameEvent, type FrameRecord, type Match } from '../engine';
import { DEFAULT_SETTINGS, PROFILE_COLOURS, type AppData, type PlayerProfile, type Settings } from './types';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export const STORAGE_PREFIX = 'snooker/v1/';
const MATCH_PREFIX = `${STORAGE_PREFIX}match/`;

export const KEYS = {
  settings: `${STORAGE_PREFIX}settings`,
  profiles: `${STORAGE_PREFIX}profiles`,
  match: (id: string) => `${MATCH_PREFIX}${id}`,
};

/** In-memory storage used by the unit tests (and as a fallback if storage is unavailable). */
export function createMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    async getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    async setItem(key: string, value: string) {
      map.set(key, value);
    },
    async removeItem(key: string) {
      map.delete(key);
    },
    async getAllKeys() {
      return [...map.keys()];
    },
    /** Snapshot of everything stored - handy for simulating an app restart. */
    dump(): Record<string, string> {
      return Object.fromEntries(map);
    },
  };
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitiseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const theme = raw.theme === 'midnight' || raw.theme === 'light' || raw.theme === 'baize' ? raw.theme : 'baize';
  let lastSetup: Settings['lastSetup'] = null;
  const setup = raw.lastSetup;
  if (isRecord(setup) && Array.isArray(setup.names)) {
    const distribution = setup.foulDistribution;
    lastSetup = {
      names: setup.names.filter((name): name is string => typeof name === 'string').slice(0, 10),
      bestOf: typeof setup.bestOf === 'number' && Number.isInteger(setup.bestOf) ? setup.bestOf : 1,
      totalReds: typeof setup.totalReds === 'number' && Number.isInteger(setup.totalReds) ? setup.totalReds : 15,
      foulDistribution: distribution === 'all' || distribution === 'manual' ? distribution : 'next',
    };
  }
  return {
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound,
    haptics: typeof raw.haptics === 'boolean' ? raw.haptics : DEFAULT_SETTINGS.haptics,
    keepAwake: typeof raw.keepAwake === 'boolean' ? raw.keepAwake : DEFAULT_SETTINGS.keepAwake,
    theme,
    lastSetup,
  };
}

export function sanitiseProfiles(raw: unknown): PlayerProfile[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const profiles: PlayerProfile[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') continue;
    if (!item.name.trim() || seen.has(item.id)) continue;
    seen.add(item.id);
    profiles.push({
      id: item.id,
      name: item.name,
      colour: typeof item.colour === 'string' ? item.colour : PROFILE_COLOURS[profiles.length % PROFILE_COLOURS.length],
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    });
  }
  return profiles;
}

function sanitiseFrame(raw: unknown, playerIds: Set<string>): FrameRecord | null {
  if (!isRecord(raw) || typeof raw.number !== 'number' || typeof raw.breakerId !== 'string') return null;
  if (!playerIds.has(raw.breakerId)) return null;
  const events = Array.isArray(raw.events)
    ? (raw.events.filter((event) => isRecord(event) && typeof event.type === 'string') as unknown as FrameEvent[])
    : [];
  let result: FrameRecord['result'] = null;
  if (isRecord(raw.result) && typeof raw.result.winnerId === 'string' && isRecord(raw.result.stats)) {
    result = raw.result as unknown as FrameRecord['result'];
  }
  return {
    number: raw.number,
    breakerId: raw.breakerId,
    events,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : 0,
    endedAt: typeof raw.endedAt === 'number' ? raw.endedAt : null,
    result,
  };
}

/** Returns a usable match, or `null` if the stored record is too damaged to load. */
export function sanitiseMatch(raw: unknown): Match | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.config)) return null;
  const config = raw.config as unknown as Match['config'];
  if (!Array.isArray(config.players)) return null;
  for (const player of config.players) {
    if (!isRecord(player) || typeof player.id !== 'string' || typeof player.name !== 'string') return null;
  }
  if (validateConfig(config) !== null) return null;

  const playerIds = new Set(config.players.map((p) => p.id));
  const status = raw.status === 'finished' ? 'finished' : 'active';
  const frames: FrameRecord[] = [];
  if (Array.isArray(raw.frames)) {
    for (const item of raw.frames) {
      const frame = sanitiseFrame(item, playerIds);
      if (frame) frames.push(frame);
    }
  }
  if (status === 'active' && frames.length === 0) return null;
  // A finished match only keeps frames that have a result.
  const kept = status === 'finished' ? frames.filter((frame) => frame.result !== null) : frames;

  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : 0;
  return {
    id: raw.id,
    createdAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt,
    finishedAt: typeof raw.finishedAt === 'number' ? raw.finishedAt : null,
    status,
    config: {
      mode: config.mode,
      players: config.players.map((p) => ({
        id: p.id,
        name: p.name,
        profileId: typeof p.profileId === 'string' ? p.profileId : null,
      })),
      bestOf: config.bestOf,
      totalReds: config.totalReds,
      foulDistribution: config.foulDistribution,
    },
    frames: kept,
    winnerIds: Array.isArray(raw.winnerIds)
      ? raw.winnerIds.filter((id): id is string => typeof id === 'string' && playerIds.has(id))
      : [],
  };
}

/** Reads everything back from storage. Never throws: unreadable data falls back to defaults. */
export async function loadAppData(storage: KeyValueStorage): Promise<AppData> {
  let keys: readonly string[] = [];
  try {
    keys = await storage.getAllKeys();
  } catch {
    keys = [];
  }
  const read = async (key: string): Promise<unknown> => {
    try {
      return parseJson(await storage.getItem(key));
    } catch {
      return null;
    }
  };

  const [settingsRaw, profilesRaw] = await Promise.all([read(KEYS.settings), read(KEYS.profiles)]);
  const matchKeys = keys.filter((key) => key.startsWith(MATCH_PREFIX));
  const matchesRaw = await Promise.all(matchKeys.map(read));

  const matches: Match[] = [];
  for (const raw of matchesRaw) {
    const match = sanitiseMatch(raw);
    if (match) matches.push(match);
  }
  matches.sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    settings: sanitiseSettings(settingsRaw),
    profiles: sanitiseProfiles(profilesRaw),
    matches,
  };
}

export interface Persister {
  /** Queues a write for every part of the data that changed between two snapshots. */
  save(previous: AppData, next: AppData): void;
  /** Resolves once everything queued has reached storage. */
  flush(): Promise<void>;
}

/**
 * Writes changes in the background, one at a time and in order. If the same
 * key is changed again before its write starts, only the newest value is
 * written - so rapid scoring never builds a backlog.
 */
export function createPersister(storage: KeyValueStorage, onError: (error: unknown) => void = () => {}): Persister {
  const pending = new Map<string, string | null>(); // null = delete the key
  let draining: Promise<void> | null = null;

  async function drain(): Promise<void> {
    while (pending.size > 0) {
      const [key, value] = pending.entries().next().value as [string, string | null];
      pending.delete(key);
      try {
        if (value === null) await storage.removeItem(key);
        else await storage.setItem(key, value);
      } catch (error) {
        onError(error);
      }
    }
  }

  function schedule(key: string, value: string | null): void {
    pending.set(key, value);
    if (!draining) {
      draining = drain().finally(() => {
        draining = null;
      });
    }
  }

  return {
    save(previous, next) {
      if (previous.settings !== next.settings) schedule(KEYS.settings, JSON.stringify(next.settings));
      if (previous.profiles !== next.profiles) schedule(KEYS.profiles, JSON.stringify(next.profiles));
      if (previous.matches !== next.matches) {
        const before = new Map(previous.matches.map((match) => [match.id, match]));
        for (const match of next.matches) {
          if (before.get(match.id) !== match) schedule(KEYS.match(match.id), JSON.stringify(match));
          before.delete(match.id);
        }
        for (const id of before.keys()) schedule(KEYS.match(id), null);
      }
    },
    async flush() {
      while (draining) await draining;
    },
  };
}
