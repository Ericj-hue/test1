/**
 * Plain-text match report used by "Share as text".
 */
import { BALL_VALUES } from './balls';
import { completedResults, matchStanding, playerName } from './match';
import { matchTotals } from './stats';
import type { EndReason, FrameEvent, Match, MatchConfig } from './types';

/**
 * A short description of a recorded event, used to confirm what "undo" removed.
 * `strikerId` is the player who was at the table when the event was recorded.
 */
export function describeEvent(event: FrameEvent, config: MatchConfig, strikerId: string): string {
  const who = playerName(config, strikerId);
  switch (event.type) {
    case 'pot':
      return event.sameStroke
        ? `${who}'s extra red (+1)`
        : `${who} potted the ${event.ball} (+${BALL_VALUES[event.ball]})`;
    case 'freeBallPot':
      return `${who}'s free ball (${event.nominated} nominated)`;
    case 'endTurn':
      return `end of ${who}'s turn`;
    case 'foul':
      return `foul by ${who} (${event.penalty})`;
    case 'adjustScore':
      return `score correction for ${playerName(config, event.playerId)} (${event.delta > 0 ? '+' : ''}${event.delta})`;
    case 'setReds':
      return `reds corrected to ${event.reds}`;
    case 'setStriker':
      return `turn passed to ${playerName(config, event.playerId)}`;
    case 'setFreeBall':
      return event.value ? 'free ball awarded' : 'free ball cancelled';
    case 'respotBlack':
      return 're-spotted black';
    case 'concede':
      return `frame awarded to ${playerName(config, event.winnerId)}`;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(timestamp)}, ${date.getHours()}:${minutes}`;
}

export function formatLabel(bestOf: number): string {
  return bestOf === 1 ? 'Single frame' : `Best of ${bestOf}`;
}

export function endReasonLabel(reason: EndReason): string {
  switch (reason) {
    case 'cleared':
      return 'Table cleared';
    case 'finalBlackFoul':
      return 'Foul on the final black';
    case 'respottedBlack':
      return 'Re-spotted black';
    case 'conceded':
      return 'Frame conceded';
  }
}

export function winnerLine(match: Match): string {
  if (match.winnerIds.length === 0) return 'No result';
  const names = match.winnerIds.map((id) => playerName(match.config, id));
  return names.length === 1 ? `Winner: ${names[0]}` : `Drawn: ${names.join(' & ')}`;
}

export function formatMatchText(match: Match): string {
  const { config } = match;
  const standing = matchStanding(match);
  const totals = matchTotals(match);
  const lines: string[] = [];

  lines.push(`Snooker - ${formatLabel(config.bestOf)}${config.totalReds !== 15 ? ` (${config.totalReds} reds)` : ''}`);
  lines.push(formatDate(match.finishedAt ?? match.updatedAt));
  lines.push('');

  if (config.players.length === 2) {
    const [a, b] = config.players;
    lines.push(`${a.name} ${standing.wins[a.id]} - ${standing.wins[b.id]} ${b.name}`);
  } else {
    const ranked = [...config.players].sort(
      (x, y) => standing.wins[y.id] - standing.wins[x.id] || standing.points[y.id] - standing.points[x.id],
    );
    ranked.forEach((player, index) => {
      const frames = standing.wins[player.id];
      lines.push(
        `${index + 1}. ${player.name} - ${frames} ${frames === 1 ? 'frame' : 'frames'}, ${standing.points[player.id]} pts`,
      );
    });
  }
  lines.push(match.status === 'finished' ? winnerLine(match) : 'Match in progress');
  lines.push('');

  const results = completedResults(match);
  results.forEach((result, index) => {
    const scores = config.players.map((p) => `${p.name} ${result.stats[p.id]?.points ?? 0}`).join(', ');
    const note = result.endReason === 'cleared' ? '' : ` (${endReasonLabel(result.endReason).toLowerCase()})`;
    lines.push(`Frame ${index + 1}: ${scores} - won by ${playerName(config, result.winnerId)}${note}`);
  });
  if (results.length > 0) lines.push('');

  lines.push('Highest breaks');
  for (const player of config.players) {
    const mine = totals[player.id];
    const extras: string[] = [];
    if (mine.maximums > 0) extras.push(`${mine.maximums} x 147`);
    else if (mine.centuries > 0) extras.push(`${mine.centuries} x 100+`);
    lines.push(`${player.name}: ${mine.highestBreak}${extras.length ? ` (${extras.join(', ')})` : ''}`);
  }
  lines.push('');
  lines.push('Scored with Snooker Scoreboard');
  return lines.join('\n');
}
