import {
  currentFrame,
  formatDate,
  liveState,
  matchStanding,
  playerName,
  type Match,
  type MatchConfig,
} from '@/engine';

/** "Ann v Bob", or "Ann, Bob +3 more" for bigger games. */
export function matchTitle(config: MatchConfig): string {
  const names = config.players.map((p) => p.name);
  if (names.length === 2) return `${names[0]} v ${names[1]}`;
  if (names.length === 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

/** Frames score, e.g. "2 - 1", or the leader's tally for multiplayer matches. */
export function framesLine(match: Match): string {
  const standing = matchStanding(match);
  const { players } = match.config;
  if (players.length === 2) return `${standing.wins[players[0].id]} - ${standing.wins[players[1].id]}`;
  const best = Math.max(...players.map((p) => standing.wins[p.id]));
  if (best === 0) return 'No frames won yet';
  const leaders = standing.leaderIds.map((id) => playerName(match.config, id));
  return leaders.length === 1 ? `${leaders[0]} leads with ${best}` : `${leaders.join(' & ')} level on ${best}`;
}

/** Where an unfinished match stands: "Frame 2 · 45 - 32". */
export function progressLine(match: Match): string {
  const frame = currentFrame(match);
  const state = liveState(match);
  if (!frame || !state) return '';
  const { players } = match.config;
  if (players.length === 2) {
    return `Frame ${frame.number} · ${state.stats[players[0].id].points} - ${state.stats[players[1].id].points}`;
  }
  const top = Math.max(...players.map((p) => state.stats[p.id].points));
  return `Frame ${frame.number} · top score ${top}`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Outcome of a match in a few words: "Ann won 3 - 1", "Match drawn", "In progress". */
export function resultLine(match: Match): string {
  if (match.status !== 'finished') return 'In progress';
  if (match.winnerIds.length === 0) return 'No result';
  if (match.winnerIds.length > 1) return 'Match drawn';
  const winnerId = match.winnerIds[0];
  const winner = playerName(match.config, winnerId);
  const standing = matchStanding(match);
  const { players, bestOf } = match.config;
  if (players.length === 2) {
    const loser = players.find((p) => p.id !== winnerId);
    if (bestOf === 1 && match.frames[0]?.result && loser) {
      const stats = match.frames[0].result.stats;
      return `${winner} won ${stats[winnerId]?.points ?? 0} - ${stats[loser.id]?.points ?? 0}`;
    }
    return `${winner} won ${standing.wins[winnerId]} - ${loser ? standing.wins[loser.id] : 0}`;
  }
  return bestOf === 1 ? `${winner} won the frame` : `${winner} won with ${plural(standing.wins[winnerId], 'frame')}`;
}

export function friendlyDate(timestamp: number, now = Date.now()): string {
  const day = (value: number) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const difference = Math.round((day(now) - day(timestamp)) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return formatDate(timestamp);
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
