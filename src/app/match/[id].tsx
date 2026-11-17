import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { MiniBall } from '@/components/game/Ball';
import { MATCH_COLUMNS, matchStatValues, StatsTable } from '@/components/game/StatsTable';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, SectionTitle } from '@/components/ui/Controls';
import { useConfirm } from '@/components/ui/Dialog';
import { goBack, Screen } from '@/components/ui/Screen';
import { useToast } from '@/components/ui/Toast';
import {
  ALL_BALLS,
  completedResults,
  endReasonLabel,
  formatDate,
  formatLabel,
  formatMatchText,
  matchStanding,
  matchTotals,
  playerName,
  type FrameResult,
  type Match,
} from '@/engine';
import { copyText, outcomeMessage, shareImage, shareText } from '@/services/share';
import { app, useApp } from '@/store';
import { radius, space, tabular } from '@/theme';
import { matchTitle, resultLine } from '@/utils/format';

// The result card always uses the baize colours, whatever theme is selected,
// so shared images look the same for everyone.
const CARD = {
  background: '#0A3626',
  panel: 'rgba(0, 0, 0, 0.28)',
  line: 'rgba(255, 255, 255, 0.14)',
  text: '#FFFFFF',
  dim: 'rgba(255, 255, 255, 0.72)',
  gold: '#E9BC55',
};

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useApp((state) => state.matches.find((m) => m.id === id));
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  if (!match) {
    return (
      <Screen title="Match">
        <EmptyState
          icon="alert"
          title="Match not found"
          message="This match is no longer saved on this device."
          action={<Button label="Back to home" variant="primary" onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }

  const { config } = match;
  const totals = matchTotals(match);
  const finished = match.status === 'finished';

  const report = (message: string | null) => {
    if (message) toast.show({ message });
  };

  const onShareImage = async () => {
    setBusy(true);
    const outcome = await shareImage(cardRef, `snooker-${formatDate(match.finishedAt ?? match.updatedAt).replace(/ /g, '-')}`);
    setBusy(false);
    report(outcomeMessage(outcome));
  };

  const onShareText = async () => report(outcomeMessage(await shareText(formatMatchText(match))));

  const onCopy = async () =>
    report((await copyText(formatMatchText(match))) ? 'Result copied to the clipboard' : 'Could not copy the result');

  const rematch = () => {
    const result = app().startMatch({
      players: config.players.map((p) => ({ name: p.name, profileId: p.profileId })),
      bestOf: config.bestOf,
      totalReds: config.totalReds,
      foulDistribution: config.foulDistribution === 'opponent' ? 'next' : config.foulDistribution,
    });
    if (result.ok) router.replace({ pathname: '/game/[id]', params: { id: result.matchId } });
    else toast.show({ message: result.error, tone: 'warning' });
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: 'Delete this match?',
      message: 'It will be removed from your history and statistics. This cannot be undone.',
      confirmLabel: 'Delete match',
      destructive: true,
    });
    if (!confirmed) return;
    app().deleteMatch(match.id);
    goBack();
  };

  return (
    <Screen title={finished ? 'Match result' : 'Match in progress'} subtitle={matchTitle(config)}>
      {finished ? null : (
        <Button
          label="Resume match"
          icon="play"
          variant="primary"
          size="lg"
          onPress={() => router.push({ pathname: '/game/[id]', params: { id: match.id } })}
          testID="match-resume"
        />
      )}

      <View ref={cardRef} collapsable={false} style={styles.cardShell}>
        <ResultCard match={match} />
      </View>

      <View style={styles.row}>
        <Button label="Share image" icon="image" onPress={onShareImage} disabled={busy} grow testID="share-image" />
        <Button label="Share text" icon="share" onPress={onShareText} grow testID="share-text" />
      </View>
      <Button label="Copy result as text" icon="copy" variant="ghost" size="sm" onPress={onCopy} testID="copy-text" />

      <View style={styles.section}>
        <SectionTitle>Player statistics</SectionTitle>
        <Card>
          <StatsTable
            columns={MATCH_COLUMNS}
            rows={config.players.map((p) => ({
              id: p.id,
              name: p.name,
              highlight: match.winnerIds.includes(p.id),
              values: matchStatValues(totals[p.id]),
            }))}
          />
          <AppText variant="caption" tone="muted">
            Break = highest break. Pots = balls potted. Pen + = points received from fouls.
          </AppText>
        </Card>
      </View>

      <View style={styles.section}>
        <Button label="Play again with these players" icon="restart" onPress={rematch} testID="rematch" />
        <Button label="Delete match" icon="trash" variant="ghost" onPress={remove} testID="delete-match" />
      </View>
    </Screen>
  );
}

function ResultCard({ match }: { match: Match }) {
  const { config } = match;
  const standing = matchStanding(match);
  const totals = matchTotals(match);
  const results = completedResults(match);
  const singleFrame = config.bestOf === 1;
  const twoPlayers = config.players.length === 2;

  const ranked = [...config.players].sort(
    (a, b) => standing.wins[b.id] - standing.wins[a.id] || standing.points[b.id] - standing.points[a.id],
  );
  const best = ranked.reduce((top, p) => (totals[p.id].highestBreak > totals[top.id].highestBreak ? p : top), ranked[0]);
  const bestBreak = totals[best.id].highestBreak;

  return (
    <View style={[styles.card, { backgroundColor: CARD.background }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardBalls}>
          {ALL_BALLS.map((ball) => (
            <MiniBall key={ball} ball={ball} size={12} />
          ))}
        </View>
        <AppText style={[styles.cardMeta, { color: CARD.dim }]} maxFontSizeMultiplier={1}>
          {formatDate(match.finishedAt ?? match.updatedAt)}
        </AppText>
      </View>

      <View style={styles.cardHead}>
        <AppText style={[styles.cardLabel, { color: CARD.gold }]} maxFontSizeMultiplier={1}>
          SNOOKER · {formatLabel(config.bestOf).toUpperCase()}
          {config.totalReds !== 15 ? ` · ${config.totalReds} REDS` : ''}
        </AppText>
        <AppText style={[styles.cardTitle, { color: CARD.text }]} maxFontSizeMultiplier={1.1} testID="result-line">
          {resultLine(match)}
        </AppText>
      </View>

      <View style={[styles.cardPanel, { backgroundColor: CARD.panel }]}>
        {ranked.map((player, index) => {
          const won = match.winnerIds.includes(player.id);
          return (
            <View
              key={player.id}
              style={[styles.cardRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CARD.line }]}>
              <AppText numberOfLines={1} style={[styles.cardName, { color: won ? CARD.gold : CARD.text }]} maxFontSizeMultiplier={1.1}>
                {player.name}
              </AppText>
              {singleFrame ? null : (
                <AppText style={[styles.cardPoints, tabular, { color: CARD.dim }]} maxFontSizeMultiplier={1}>
                  {standing.points[player.id]} pts
                </AppText>
              )}
              <AppText style={[styles.cardScore, tabular, { color: won ? CARD.gold : CARD.text }]} maxFontSizeMultiplier={1}>
                {singleFrame ? standing.points[player.id] : standing.wins[player.id]}
              </AppText>
            </View>
          );
        })}
      </View>

      {!singleFrame && results.length > 0 ? (
        <View style={styles.cardFrames}>
          {results.map((result, index) => (
            <FrameLine key={index} match={match} result={result} number={index + 1} twoPlayers={twoPlayers} />
          ))}
        </View>
      ) : null}

      {singleFrame && results[0] && results[0].endReason !== 'cleared' ? (
        <AppText style={[styles.cardMeta, { color: CARD.dim }]} maxFontSizeMultiplier={1}>
          {endReasonLabel(results[0].endReason)}
        </AppText>
      ) : null}

      <View style={[styles.cardFoot, { borderTopColor: CARD.line }]}>
        <AppText style={[styles.cardMeta, { color: CARD.text }]} maxFontSizeMultiplier={1}>
          {bestBreak > 0 ? `Highest break ${bestBreak} · ${best.name}` : 'No breaks recorded'}
        </AppText>
        <AppText style={[styles.cardMeta, { color: CARD.dim }]} maxFontSizeMultiplier={1}>
          Snooker Scoreboard
        </AppText>
      </View>
    </View>
  );
}

function FrameLine({
  match,
  result,
  number,
  twoPlayers,
}: {
  match: Match;
  result: FrameResult;
  number: number;
  twoPlayers: boolean;
}) {
  const { players } = match.config;
  const score = (id: string) => result.stats[id]?.points ?? 0;
  let detail: string;
  if (twoPlayers) {
    detail = `${score(players[0].id)} - ${score(players[1].id)}`;
  } else {
    detail = [...players]
      .sort((a, b) => score(b.id) - score(a.id))
      .map((p) => `${p.name} ${score(p.id)}`)
      .join(' · ');
  }
  const note = result.maximumBy ? ' · 147!' : result.endReason === 'cleared' ? '' : ` · ${endReasonLabel(result.endReason).toLowerCase()}`;
  return (
    <View style={styles.frameLine}>
      <AppText style={[styles.frameNumber, tabular, { color: CARD.dim }]} maxFontSizeMultiplier={1}>
        {number}
      </AppText>
      <AppText style={[styles.frameDetail, tabular, { color: CARD.text }]} numberOfLines={2} maxFontSizeMultiplier={1.1}>
        {detail}
      </AppText>
      <AppText style={[styles.frameWinner, { color: CARD.gold }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
        {playerName(match.config, result.winnerId)}
        {note}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  cardShell: { borderRadius: radius.xl, overflow: 'hidden' },
  card: { padding: space.xl, gap: space.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBalls: { flexDirection: 'row', gap: 4 },
  cardMeta: { fontSize: 12, fontWeight: '600' },
  cardHead: { gap: 4 },
  cardLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  cardTitle: { fontSize: 26, fontWeight: '800', lineHeight: 31 },
  cardPanel: { borderRadius: radius.lg, paddingHorizontal: space.lg },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  cardName: { flex: 1, fontSize: 18, fontWeight: '700' },
  cardPoints: { fontSize: 13, fontWeight: '600' },
  cardScore: { fontSize: 32, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  cardFrames: { gap: 6 },
  frameLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  frameNumber: { width: 18, fontSize: 12, fontWeight: '700' },
  frameDetail: { flex: 1, fontSize: 14, fontWeight: '600' },
  frameWinner: { fontSize: 12, fontWeight: '700', maxWidth: '46%' },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
  },
});
