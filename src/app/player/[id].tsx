import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { MatchRow } from '@/components/MatchRow';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Avatar, EmptyState, SectionTitle } from '@/components/ui/Controls';
import { useConfirm, usePrompt } from '@/components/ui/Dialog';
import { goBack, Screen } from '@/components/ui/Screen';
import { StatGrid } from '@/components/ui/StatGrid';
import { useToast } from '@/components/ui/Toast';
import { averagePointsPerFrame, ballsPotted, careerStats, formatDate, winRate } from '@/engine';
import { app, MAX_NAME_LENGTH, PROFILE_COLOURS, useApp } from '@/store';
import { space, useTheme } from '@/theme';
import { percent } from '@/utils/format';

export default function PlayerScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useApp((state) => state.profiles.find((p) => p.id === id));
  const matches = useApp((state) => state.matches);
  const prompt = usePrompt();
  const confirm = useConfirm();
  const toast = useToast();

  if (!profile) {
    return (
      <Screen title="Player">
        <EmptyState
          icon="user"
          title="Player not found"
          message="This player has been deleted."
          action={<Button label="All players" variant="primary" onPress={() => router.replace('/players')} />}
        />
      </Screen>
    );
  }

  const stats = careerStats(matches)[profile.id];
  const played = matches
    .filter((match) => match.config.players.some((p) => p.profileId === profile.id))
    .sort((a, b) => (b.finishedAt ?? b.updatedAt) - (a.finishedAt ?? a.updatedAt));

  const rename = async () => {
    const name = await prompt({
      title: 'Rename player',
      initialValue: profile.name,
      confirmLabel: 'Save',
      maxLength: MAX_NAME_LENGTH,
    });
    if (!name || name === profile.name) return;
    const result = app().renameProfile(profile.id, name);
    if (!result.ok) toast.show({ message: result.error, tone: 'warning' });
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: `Delete ${profile.name}?`,
      message: 'Their matches stay in the history, but their statistics will no longer be tracked.',
      confirmLabel: 'Delete player',
      destructive: true,
    });
    if (!confirmed) return;
    app().deleteProfile(profile.id);
    goBack();
  };

  return (
    <Screen title={profile.name} subtitle={`Player since ${formatDate(profile.createdAt)}`}>
      <View style={styles.hero}>
        <Avatar name={profile.name} colour={profile.colour} size={84} />
        <AppText variant="title" center testID="profile-name">
          {profile.name}
        </AppText>
        <View style={styles.colours} accessibilityRole="radiogroup" accessibilityLabel="Badge colour">
          {PROFILE_COLOURS.map((colour) => {
            const selected = colour === profile.colour;
            return (
              <Pressable
                key={colour}
                onPress={() => app().setProfileColour(profile.id, colour)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Badge colour ${colour}`}
                hitSlop={4}
                style={[
                  styles.swatch,
                  { backgroundColor: colour, borderColor: selected ? theme.text : 'transparent' },
                ]}
              />
            );
          })}
        </View>
        <Button label="Rename" icon="edit" size="sm" onPress={rename} testID="rename-profile" />
      </View>

      <View style={styles.section}>
        <SectionTitle>Career</SectionTitle>
        {stats ? (
          <StatGrid
            stats={[
              { label: 'Matches', value: stats.matchesPlayed },
              { label: 'Won', value: stats.matchesWon, note: stats.matchesDrawn > 0 ? `${stats.matchesDrawn} drawn` : undefined },
              { label: 'Win rate', value: percent(winRate(stats)) },
              { label: 'Frames won', value: stats.framesWon, note: `of ${stats.framesPlayed}` },
              { label: 'Highest break', value: stats.highestBreak },
              { label: 'Avg points / frame', value: Math.round(averagePointsPerFrame(stats)) },
              { label: 'Breaks 50+', value: stats.breaks50 },
              { label: 'Centuries', value: stats.centuries },
              { label: 'Maximums', value: stats.maximums },
              { label: 'Total points', value: stats.points },
              { label: 'Balls potted', value: ballsPotted(stats), note: `${stats.redsPotted} reds` },
              { label: 'Fouls', value: stats.fouls, note: `gave away ${stats.foulPointsConceded}` },
            ]}
          />
        ) : (
          <AppText tone="muted">Statistics appear here once {profile.name} has finished a match.</AppText>
        )}
      </View>

      {played.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>Matches</SectionTitle>
          {played.slice(0, 20).map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
          {played.length > 20 ? (
            <AppText variant="caption" tone="muted" center>
              Showing the 20 most recent of {played.length} matches.
            </AppText>
          ) : null}
        </View>
      ) : null}

      <Button label="Delete player" icon="trash" variant="ghost" onPress={remove} testID="delete-profile" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.sm },
  colours: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  section: { gap: space.sm },
});
