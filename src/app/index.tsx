import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ball } from '@/components/game/Ball';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { ALL_BALLS, formatLabel, type Match } from '@/engine';
import { useApp } from '@/store';
import { radius, space, useTheme } from '@/theme';
import { friendlyDate, matchTitle, plural, progressLine } from '@/utils/format';

export default function HomeScreen() {
  const theme = useTheme();
  const matches = useApp((state) => state.matches);
  const profiles = useApp((state) => state.profiles);

  const unfinished = matches.filter((m) => m.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt);
  const finishedCount = matches.length - unfinished.length;

  return (
    <Screen hideBack>
      <View style={styles.hero}>
        <View style={styles.balls}>
          {ALL_BALLS.map((ball) => (
            <Ball key={ball} ball={ball} size={30} />
          ))}
        </View>
        <AppText variant="display" center accessibilityRole="header">
          Snooker Scoreboard
        </AppText>
        <AppText tone="dim" center>
          Free, offline scoring for 2 to 10 players
        </AppText>
      </View>

      {unfinished.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>{unfinished.length === 1 ? 'Match in progress' : 'Matches in progress'}</SectionTitle>
          {unfinished.slice(0, 3).map((match) => (
            <ResumeCard key={match.id} match={match} />
          ))}
          {unfinished.length > 3 ? (
            <Button label={`See all ${unfinished.length} unfinished matches`} variant="ghost" size="sm" onPress={() => router.push('/history')} />
          ) : null}
        </View>
      ) : null}

      <Button
        label="New match"
        icon="plus"
        variant="primary"
        size="lg"
        onPress={() => router.push('/new-match')}
        testID="new-match"
      />

      <View style={styles.grid}>
        <MenuTile
          icon="clock"
          title="History"
          detail={finishedCount > 0 ? plural(finishedCount, 'match', 'matches') : 'No matches yet'}
          onPress={() => router.push('/history')}
          testID="home-history"
        />
        <MenuTile
          icon="users"
          title="Players"
          detail={profiles.length > 0 ? plural(profiles.length, 'player') : 'Add players'}
          onPress={() => router.push('/players')}
          testID="home-players"
        />
        <MenuTile icon="stats" title="Statistics" detail="Breaks and wins" onPress={() => router.push('/stats')} testID="home-stats" />
        <MenuTile icon="book" title="Rules" detail="Quick reference" onPress={() => router.push('/rules')} testID="home-rules" />
        <MenuTile icon="settings" title="Settings" detail="Sound, theme" onPress={() => router.push('/settings')} testID="home-settings" />
      </View>

      <AppText variant="caption" tone="muted" center style={{ color: theme.textMuted }}>
        No account, no adverts, no subscription. Everything stays on this device.
      </AppText>
    </Screen>
  );
}

function ResumeCard({ match }: { match: Match }) {
  const theme = useTheme();
  const open = () => router.push({ pathname: '/game/[id]', params: { id: match.id } });
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Resume ${matchTitle(match.config)}`}
      testID={`resume-${match.id}`}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={[styles.resume, { borderColor: theme.accent }]}>
        <View style={styles.flex}>
          <AppText variant="heading" numberOfLines={1}>
            {matchTitle(match.config)}
          </AppText>
          <AppText variant="caption" tone="dim" numberOfLines={1}>
            {progressLine(match)}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {formatLabel(match.config.bestOf)} · {friendlyDate(match.updatedAt)}
          </AppText>
        </View>
        <View style={[styles.resumeButton, { backgroundColor: theme.accent }]}>
          <Icon name="play" size={18} color={theme.onAccent} />
          <AppText style={[styles.resumeText, { color: theme.onAccent }]}>Resume</AppText>
        </View>
      </Card>
    </Pressable>
  );
}

interface MenuTileProps {
  icon: IconName;
  title: string;
  detail: string;
  onPress: () => void;
  testID: string;
}

function MenuTile({ icon, title, detail, onPress, testID }: MenuTileProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      testID={testID}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={24} color={theme.accent} />
      <View style={styles.tileText}>
        <AppText variant="strong" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {detail}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.xl, paddingBottom: space.sm },
  balls: { flexDirection: 'row', gap: 6, marginBottom: space.sm },
  section: { gap: space.sm },
  resume: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  resumeText: { fontWeight: '700', fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  tileText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.72 },
});
