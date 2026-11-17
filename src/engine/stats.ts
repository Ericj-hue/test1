/**
 * Statistics: per-match totals and career figures across saved matches.
 */
import { completedResults, currentFrame, frameStateOf } from './match';
import type { Match, PlayerFrameStats } from './types';

export interface PlayerTotals {
  framesPlayed: number;
  framesWon: number;
  points: number;
  pointsFromPots: number;
  pointsFromFouls: number;
  highestBreak: number;
  /** Breaks of 50 or more (centuries included). */
  breaks50: number;
  /** Breaks of 100 or more. */
  centuries: number;
  /** Genuine 147s. */
  maximums: number;
  redsPotted: number;
  coloursPotted: number;
  freeBallsPotted: number;
  fouls: number;
  foulPointsConceded: number;
  visits: number;
}

export function emptyTotals(): PlayerTotals {
  return {
    framesPlayed: 0,
    framesWon: 0,
    points: 0,
    pointsFromPots: 0,
    pointsFromFouls: 0,
    highestBreak: 0,
    breaks50: 0,
    centuries: 0,
    maximums: 0,
    redsPotted: 0,
    coloursPotted: 0,
    freeBallsPotted: 0,
    fouls: 0,
    foulPointsConceded: 0,
    visits: 0,
  };
}

function addFrame(totals: PlayerTotals, stats: PlayerFrameStats, won: boolean, maximum: boolean): void {
  totals.framesPlayed += 1;
  if (won) totals.framesWon += 1;
  totals.points += stats.points;
  totals.pointsFromPots += stats.pointsFromPots;
  totals.pointsFromFouls += stats.pointsFromFouls;
  totals.highestBreak = Math.max(totals.highestBreak, stats.highestBreak);
  // `breaks` lists finished breaks; `highestBreak` also covers one still being made.
  const breaks = stats.breaks.includes(stats.highestBreak) ? stats.breaks : [...stats.breaks, stats.highestBreak];
  for (const value of breaks) {
    if (value >= 50) totals.breaks50 += 1;
    if (value >= 100) totals.centuries += 1;
  }
  if (maximum) totals.maximums += 1;
  totals.redsPotted += stats.redsPotted;
  totals.coloursPotted += stats.coloursPotted;
  totals.freeBallsPotted += stats.freeBallsPotted;
  totals.fouls += stats.foulsCommitted;
  totals.foulPointsConceded += stats.foulPointsConceded;
  totals.visits += stats.visits;
}

export function ballsPotted(totals: PlayerTotals): number {
  return totals.redsPotted + totals.coloursPotted + totals.freeBallsPotted;
}

export function averagePointsPerFrame(totals: PlayerTotals): number {
  return totals.framesPlayed > 0 ? totals.points / totals.framesPlayed : 0;
}

/**
 * Totals for each player in a match, keyed by match player id.
 * With `includeLive` the frame in progress is counted too (without a winner).
 */
export function matchTotals(match: Match, includeLive = false): Record<string, PlayerTotals> {
  const totals: Record<string, PlayerTotals> = {};
  for (const player of match.config.players) totals[player.id] = emptyTotals();

  const results = completedResults(match);
  for (const result of results) {
    for (const player of match.config.players) {
      const stats = result.stats[player.id];
      if (stats) addFrame(totals[player.id], stats, result.winnerId === player.id, result.maximumBy === player.id);
    }
  }

  if (includeLive && match.status === 'active') {
    const frame = currentFrame(match);
    if (frame && !frame.result) {
      const state = frameStateOf(match.config, frame);
      if (state.phase !== 'over') {
        for (const player of match.config.players) {
          addFrame(totals[player.id], state.stats[player.id], false, state.maximumBy === player.id);
        }
      }
    }
  }
  return totals;
}

export interface CareerStats extends PlayerTotals {
  profileId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesDrawn: number;
  matchesLost: number;
  lastPlayedAt: number | null;
}

/** Career figures per saved profile, built from finished matches only. */
export function careerStats(matches: readonly Match[]): Record<string, CareerStats> {
  const career: Record<string, CareerStats> = {};
  for (const match of matches) {
    if (match.status !== 'finished' || match.frames.length === 0) continue;
    const totals = matchTotals(match);
    for (const player of match.config.players) {
      if (!player.profileId) continue;
      const entry = (career[player.profileId] ??= {
        ...emptyTotals(),
        profileId: player.profileId,
        matchesPlayed: 0,
        matchesWon: 0,
        matchesDrawn: 0,
        matchesLost: 0,
        lastPlayedAt: null,
      });
      const mine = totals[player.id];
      entry.matchesPlayed += 1;
      const won = match.winnerIds.includes(player.id);
      if (won && match.winnerIds.length === 1) entry.matchesWon += 1;
      else if (won) entry.matchesDrawn += 1;
      else entry.matchesLost += 1;
      const playedAt = match.finishedAt ?? match.updatedAt;
      entry.lastPlayedAt = Math.max(entry.lastPlayedAt ?? 0, playedAt);

      entry.framesPlayed += mine.framesPlayed;
      entry.framesWon += mine.framesWon;
      entry.points += mine.points;
      entry.pointsFromPots += mine.pointsFromPots;
      entry.pointsFromFouls += mine.pointsFromFouls;
      entry.highestBreak = Math.max(entry.highestBreak, mine.highestBreak);
      entry.breaks50 += mine.breaks50;
      entry.centuries += mine.centuries;
      entry.maximums += mine.maximums;
      entry.redsPotted += mine.redsPotted;
      entry.coloursPotted += mine.coloursPotted;
      entry.freeBallsPotted += mine.freeBallsPotted;
      entry.fouls += mine.fouls;
      entry.foulPointsConceded += mine.foulPointsConceded;
      entry.visits += mine.visits;
    }
  }
  return career;
}

export function winRate(stats: Pick<CareerStats, 'matchesPlayed' | 'matchesWon'>): number {
  return stats.matchesPlayed > 0 ? stats.matchesWon / stats.matchesPlayed : 0;
}
