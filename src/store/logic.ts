/**
 * Pure state transitions for the whole app (matches, players, settings).
 * Nothing here touches storage or React, so it is all unit-tested directly.
 */
import {
  buildConfig,
  createMatch,
  finishMatch,
  recordEvent,
  restartFrame,
  RuleError,
  startNextFrame,
  undoLastEvent,
  type FrameEvent,
  type Match,
  type MatchPlayer,
} from '../engine';
import { PROFILE_COLOURS, type AppData, type NewMatchInput, type PlayerProfile, type Settings } from './types';

export const MAX_NAME_LENGTH = 24;

type MakeId = (prefix?: string) => string;

export function findMatch(data: AppData, matchId: string | null | undefined): Match | undefined {
  return matchId ? data.matches.find((match) => match.id === matchId) : undefined;
}

function replaceMatch(data: AppData, match: Match): AppData {
  return { ...data, matches: data.matches.map((existing) => (existing.id === match.id ? match : existing)) };
}

function requireMatch(data: AppData, matchId: string): Match {
  const match = findMatch(data, matchId);
  if (!match) throw new RuleError('This match could not be found.');
  return match;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function nextColour(profiles: PlayerProfile[]): string {
  return PROFILE_COLOURS[profiles.length % PROFILE_COLOURS.length];
}

/** Unfinished matches, most recently played first. */
export function unfinishedMatches(data: Pick<AppData, 'matches'>): Match[] {
  return data.matches.filter((match) => match.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Finished matches, most recent first. */
export function finishedMatches(data: Pick<AppData, 'matches'>): Match[] {
  return data.matches
    .filter((match) => match.status === 'finished')
    .sort((a, b) => (b.finishedAt ?? b.updatedAt) - (a.finishedAt ?? a.updatedAt));
}

/**
 * Starts a match. Every entrant is linked to a saved player profile - an
 * existing one when the name matches, otherwise a new profile is created.
 */
export function startMatch(
  data: AppData,
  input: NewMatchInput,
  now: number,
  makeId: MakeId,
): { data: AppData; matchId: string } {
  let profiles = data.profiles;
  const players: MatchPlayer[] = [];

  input.players.forEach((entry, index) => {
    const typed = cleanName(entry.name);
    let profile = entry.profileId ? profiles.find((p) => p.id === entry.profileId) : undefined;
    if (!profile && typed) profile = profiles.find((p) => sameName(p.name, typed));
    if (!profile && typed) {
      profile = { id: makeId('pl_'), name: typed, colour: nextColour(profiles), createdAt: now };
      profiles = [...profiles, profile];
    }
    players.push({ id: `p${index + 1}`, name: profile?.name ?? typed, profileId: profile?.id ?? null });
  });

  const profileIds = players.map((p) => p.profileId).filter((id): id is string => id !== null);
  if (new Set(profileIds).size !== profileIds.length) {
    throw new RuleError('The same player has been added twice.');
  }

  const config = buildConfig({
    players,
    bestOf: input.bestOf,
    totalReds: input.totalReds,
    foulDistribution: input.foulDistribution,
  });
  const match = createMatch(makeId('m_'), config, now); // throws RuleError if the set-up is invalid

  const settings: Settings = {
    ...data.settings,
    lastSetup: {
      names: players.map((p) => p.name),
      bestOf: input.bestOf,
      totalReds: input.totalReds,
      foulDistribution: input.foulDistribution,
    },
  };
  return { data: { settings, profiles, matches: [match, ...data.matches] }, matchId: match.id };
}

export function recordMatchEvent(data: AppData, matchId: string, event: FrameEvent, now: number): AppData {
  return replaceMatch(data, recordEvent(requireMatch(data, matchId), event, now));
}

export function undoMatchEvent(data: AppData, matchId: string, now: number): AppData {
  const match = requireMatch(data, matchId);
  const undone = undoLastEvent(match, now);
  return undone === match ? data : replaceMatch(data, undone);
}

export function restartMatchFrame(data: AppData, matchId: string, now: number): AppData {
  return replaceMatch(data, restartFrame(requireMatch(data, matchId), now));
}

export function advanceMatch(data: AppData, matchId: string, breakerId: string, now: number): AppData {
  return replaceMatch(data, startNextFrame(requireMatch(data, matchId), breakerId, now));
}

/**
 * Ends a match and files it in the history. A match with no completed frame
 * has nothing worth keeping, so it is removed instead.
 */
export function completeMatch(data: AppData, matchId: string, now: number): AppData {
  const finished = finishMatch(requireMatch(data, matchId), now);
  if (finished.frames.length === 0) return deleteMatch(data, matchId);
  return replaceMatch(data, finished);
}

export function deleteMatch(data: AppData, matchId: string): AppData {
  return { ...data, matches: data.matches.filter((match) => match.id !== matchId) };
}

function validateProfileName(profiles: PlayerProfile[], name: string, ignoreId?: string): string {
  const cleaned = cleanName(name);
  if (!cleaned) throw new RuleError('Enter a name.');
  if (profiles.some((p) => p.id !== ignoreId && sameName(p.name, cleaned))) {
    throw new RuleError(`There is already a player called "${cleaned}".`);
  }
  return cleaned;
}

export function addProfile(
  data: AppData,
  name: string,
  now: number,
  makeId: MakeId,
): { data: AppData; profile: PlayerProfile } {
  const cleaned = validateProfileName(data.profiles, name);
  const profile: PlayerProfile = { id: makeId('pl_'), name: cleaned, colour: nextColour(data.profiles), createdAt: now };
  return { data: { ...data, profiles: [...data.profiles, profile] }, profile };
}

/** Renames a player everywhere: the profile and every saved match they played in. */
export function renameProfile(data: AppData, profileId: string, name: string): AppData {
  const cleaned = validateProfileName(data.profiles, name, profileId);
  const profiles = data.profiles.map((p) => (p.id === profileId ? { ...p, name: cleaned } : p));
  const matches = data.matches.map((match) => {
    if (!match.config.players.some((p) => p.profileId === profileId)) return match;
    return {
      ...match,
      config: {
        ...match.config,
        players: match.config.players.map((p) => (p.profileId === profileId ? { ...p, name: cleaned } : p)),
      },
    };
  });
  return { ...data, profiles, matches };
}

export function setProfileColour(data: AppData, profileId: string, colour: string): AppData {
  return { ...data, profiles: data.profiles.map((p) => (p.id === profileId ? { ...p, colour } : p)) };
}

/** Removes a profile. Past matches keep the player's name but are no longer linked. */
export function deleteProfile(data: AppData, profileId: string): AppData {
  const matches = data.matches.map((match) => {
    if (!match.config.players.some((p) => p.profileId === profileId)) return match;
    return {
      ...match,
      config: {
        ...match.config,
        players: match.config.players.map((p) => (p.profileId === profileId ? { ...p, profileId: null } : p)),
      },
    };
  });
  return { ...data, profiles: data.profiles.filter((p) => p.id !== profileId), matches };
}

export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } };
}
