import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Avatar, EmptyState } from '@/components/ui/Controls';
import { usePrompt } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { useToast } from '@/components/ui/Toast';
import { careerStats } from '@/engine';
import { app, MAX_NAME_LENGTH, useApp } from '@/store';
import { radius, space, useTheme } from '@/theme';
import { plural } from '@/utils/format';

export default function PlayersScreen() {
  const theme = useTheme();
  const profiles = useApp((state) => state.profiles);
  const matches = useApp((state) => state.matches);
  const prompt = usePrompt();
  const toast = useToast();
  const career = careerStats(matches);

  const sorted = [...profiles].sort(
    (a, b) => (career[b.id]?.lastPlayedAt ?? 0) - (career[a.id]?.lastPlayedAt ?? 0) || a.name.localeCompare(b.name),
  );

  const add = async () => {
    const name = await prompt({
      title: 'New player',
      message: 'Saved players can be added to a match with one tap.',
      placeholder: 'Name',
      confirmLabel: 'Add',
      maxLength: MAX_NAME_LENGTH,
    });
    if (!name) return;
    const result = app().addProfile(name);
    if (!result.ok) toast.show({ message: result.error, tone: 'warning' });
  };

  return (
    <Screen
      title="Players"
      subtitle={profiles.length > 0 ? plural(profiles.length, 'saved player') : undefined}
      footer={<Button label="Add player" icon="userPlus" variant="primary" size="lg" onPress={add} testID="add-profile" />}>
      {profiles.length === 0 ? (
        <EmptyState
          icon="users"
          title="No players yet"
          message="Players are saved automatically when you start a match, or you can add them here."
        />
      ) : null}

      <View style={styles.list}>
        {sorted.map((profile) => {
          const stats = career[profile.id];
          const summary = stats
            ? `${plural(stats.matchesPlayed, 'match', 'matches')} · ${stats.matchesWon} won · high break ${stats.highestBreak}`
            : 'No finished matches yet';
          return (
            <Pressable
              key={profile.id}
              onPress={() => router.push({ pathname: '/player/[id]', params: { id: profile.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${profile.name}. ${summary}`}
              testID={`profile-${profile.name}`}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && { opacity: 0.72 },
              ]}>
              <Avatar name={profile.name} colour={profile.colour} size={42} />
              <View style={styles.text}>
                <AppText variant="strong" numberOfLines={1}>
                  {profile.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {summary}
                </AppText>
              </View>
              <Icon name="forward" size={18} color={theme.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 68,
  },
  text: { flex: 1, gap: 2 },
});
