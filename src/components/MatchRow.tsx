import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { formatLabel, type Match } from '@/engine';
import { radius, space, useTheme } from '@/theme';
import { friendlyDate, matchTitle, progressLine, resultLine } from '@/utils/format';

/** A saved match in a list. Unfinished matches open the scoreboard; finished ones open the result. */
export function MatchRow({ match }: { match: Match }) {
  const theme = useTheme();
  const active = match.status === 'active';
  const open = () =>
    active
      ? router.push({ pathname: '/game/[id]', params: { id: match.id } })
      : router.push({ pathname: '/match/[id]', params: { id: match.id } });

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${matchTitle(match.config)}. ${active ? 'In progress' : resultLine(match)}`}
      testID={`match-${match.id}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border },
        pressed && { opacity: 0.72 },
      ]}>
      <View style={styles.text}>
        <AppText variant="strong" numberOfLines={1}>
          {matchTitle(match.config)}
        </AppText>
        <AppText variant="caption" tone={active ? 'accent' : 'dim'} numberOfLines={1}>
          {active ? progressLine(match) : resultLine(match)}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {formatLabel(match.config.bestOf)} · {friendlyDate(match.finishedAt ?? match.updatedAt)}
        </AppText>
      </View>
      <Icon name={active ? 'play' : 'forward'} size={18} color={active ? theme.accent : theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 76,
  },
  text: { flex: 1, gap: 2 },
});
