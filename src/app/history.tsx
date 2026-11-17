import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MatchRow } from '@/components/MatchRow';
import { Button } from '@/components/ui/Button';
import { EmptyState, SectionTitle } from '@/components/ui/Controls';
import { Screen } from '@/components/ui/Screen';
import { finishedMatches, unfinishedMatches, useApp } from '@/store';
import { space } from '@/theme';

export default function HistoryScreen() {
  const matches = useApp((state) => state.matches);
  const active = unfinishedMatches({ matches });
  const finished = finishedMatches({ matches });

  return (
    <Screen
      title="Match history"
      subtitle={matches.length > 0 ? `${finished.length} finished · ${active.length} in progress` : undefined}>
      {matches.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No matches yet"
          message="Finished matches are kept here so you can look back at scores, breaks and results."
          action={<Button label="Start a match" variant="primary" icon="plus" onPress={() => router.push('/new-match')} />}
        />
      ) : null}

      {active.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>In progress</SectionTitle>
          {active.map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </View>
      ) : null}

      {finished.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>Finished</SectionTitle>
          {finished.map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
});
