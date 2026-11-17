import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Chip, SectionTitle, Segmented, Stepper } from '@/components/ui/Controls';
import { Screen } from '@/components/ui/Screen';
import { MATCH_FORMATS, MAX_FRAMES, MAX_PLAYERS, MIN_PLAYERS, REDS_OPTIONS } from '@/engine';
import { app, MAX_NAME_LENGTH, useApp, type NewMatchInput } from '@/store';
import { radius, space, tabular, useTheme } from '@/theme';

interface Entry {
  key: number;
  name: string;
}

type Distribution = NewMatchInput['foulDistribution'];

const DISTRIBUTION_HELP: Record<Distribution, string> = {
  next: 'Penalty points go to the next player in the rotation.',
  all: 'Every other player receives the penalty points.',
  manual: 'You choose who receives the points each time a foul is recorded.',
};

let nextKey = 1;
const blank = (name = ''): Entry => ({ key: nextKey++, name });

export default function NewMatchScreen() {
  const theme = useTheme();
  const profiles = useApp((state) => state.profiles);
  const lastSetup = useApp((state) => state.settings.lastSetup);

  const [entries, setEntries] = useState<Entry[]>(() => {
    const names = lastSetup?.names.slice(0, MAX_PLAYERS) ?? [];
    return names.length >= MIN_PLAYERS ? names.map((name) => blank(name)) : [blank(), blank()];
  });
  const [bestOf, setBestOf] = useState(lastSetup?.bestOf ?? 1);
  const [custom, setCustom] = useState(() => !MATCH_FORMATS.includes((lastSetup?.bestOf ?? 1) as (typeof MATCH_FORMATS)[number]));
  const [totalReds, setTotalReds] = useState(lastSetup?.totalReds ?? 15);
  const [distribution, setDistribution] = useState<Distribution>(lastSetup?.foulDistribution ?? 'next');
  const [error, setError] = useState<string | null>(null);

  const count = entries.length;
  const multiplayer = count > 2;

  const update = (next: Entry[]) => {
    setEntries(next);
    setError(null);
  };
  const rename = (key: number, name: string) => update(entries.map((e) => (e.key === key ? { ...e, name } : e)));
  const remove = (key: number) => update(entries.filter((e) => e.key !== key));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const copy = entries.slice();
    [copy[index], copy[target]] = [copy[target], copy[index]];
    update(copy);
  };
  const shuffle = () => {
    const copy = entries.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    update(copy);
  };
  const addSaved = (name: string) => {
    const emptyIndex = entries.findIndex((e) => !e.name.trim());
    if (emptyIndex >= 0) update(entries.map((e, i) => (i === emptyIndex ? { ...e, name } : e)));
    else if (count < MAX_PLAYERS) update([...entries, blank(name)]);
  };

  const taken = new Set(entries.map((e) => e.name.trim().toLowerCase()).filter(Boolean));
  const available = profiles.filter((p) => !taken.has(p.name.toLowerCase()));
  const hasRoom = count < MAX_PLAYERS || entries.some((e) => !e.name.trim());

  const start = () => {
    const result = app().startMatch({
      // A name left blank becomes "Player 1", "Player 2"... so a game can start with no typing.
      players: entries.map((e, index) => ({ name: e.name.trim() || `Player ${index + 1}`, profileId: null })),
      bestOf,
      totalReds,
      foulDistribution: distribution,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace({ pathname: '/game/[id]', params: { id: result.matchId } });
  };

  const target = Math.floor(bestOf / 2) + 1;
  const lengthHelp =
    bestOf === 1
      ? 'One frame decides the match.'
      : multiplayer
        ? `${bestOf} frames. Most frames wins; points break a tie.`
        : `First to ${target} ${target === 1 ? 'frame' : 'frames'} wins.`;

  return (
    <Screen
      title="New match"
      footer={
        <View style={styles.footer}>
          {error ? (
            <AppText tone="danger" variant="caption" center testID="setup-error">
              {error}
            </AppText>
          ) : null}
          <Button label="Start match" icon="play" variant="primary" size="lg" onPress={start} testID="start-match" />
        </View>
      }>
      <View style={styles.section}>
        <SectionTitle
          right={
            <AppText variant="caption" tone="accent" testID="mode-label">
              {multiplayer ? `${count} players · rotation` : '2 players · standard rules'}
            </AppText>
          }>
          Players
        </SectionTitle>
        <Card style={styles.players}>
          {entries.map((entry, index) => (
            <View key={entry.key} style={styles.playerRow}>
              <AppText style={[styles.order, tabular, { color: theme.textMuted }]}>{index + 1}</AppText>
              <TextInput
                value={entry.name}
                onChangeText={(text) => rename(entry.key, text)}
                placeholder={`Player ${index + 1}`}
                placeholderTextColor={theme.textMuted}
                maxLength={MAX_NAME_LENGTH}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel={`Name of player ${index + 1}`}
                testID={`player-name-${index}`}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
              />
              <IconButton name="arrowUp" label={`Move player ${index + 1} up`} size={18} disabled={index === 0} onPress={() => move(index, -1)} />
              <IconButton
                name="arrowDown"
                label={`Move player ${index + 1} down`}
                size={18}
                disabled={index === count - 1}
                onPress={() => move(index, 1)}
              />
              <IconButton
                name="close"
                label={`Remove player ${index + 1}`}
                size={18}
                disabled={count <= MIN_PLAYERS}
                onPress={() => remove(entry.key)}
                testID={`remove-player-${index}`}
              />
            </View>
          ))}
          <View style={styles.playerActions}>
            <Button
              label={count >= MAX_PLAYERS ? 'Maximum 10 players' : 'Add player'}
              icon="plus"
              size="sm"
              disabled={count >= MAX_PLAYERS}
              onPress={() => update([...entries, blank()])}
              grow
              testID="add-player"
            />
            <Button label="Shuffle order" icon="shuffle" size="sm" onPress={shuffle} grow testID="shuffle" />
          </View>
        </Card>
        {available.length > 0 && hasRoom ? (
          <View style={styles.chips}>
            {available.slice(0, 12).map((profile) => (
              <Chip key={profile.id} label={profile.name} icon="plus" onPress={() => addSaved(profile.name)} />
            ))}
          </View>
        ) : null}
        <AppText variant="caption" tone="muted">
          Players take turns in this order. The break-off rotates each frame.
        </AppText>
      </View>

      <View style={styles.section}>
        <SectionTitle>Match length: best of</SectionTitle>
        <Segmented
          label="Match length, best of"
          value={custom ? 0 : bestOf}
          onChange={(value) => {
            if (value === 0) {
              setCustom(true);
            } else {
              setCustom(false);
              setBestOf(value);
            }
          }}
          options={[
            ...MATCH_FORMATS.map((frames) => ({ value: frames as number, label: String(frames) })),
            { value: 0, label: 'Other' },
          ]}
        />
        {custom ? (
          <View style={styles.inline}>
            <AppText variant="strong" style={styles.flex}>
              Number of frames
            </AppText>
            <Stepper label="Frames" value={bestOf} min={1} max={MAX_FRAMES} onChange={setBestOf} />
          </View>
        ) : null}
        <AppText variant="caption" tone="muted" testID="length-help">
          {lengthHelp}
        </AppText>
      </View>

      {multiplayer ? (
        <View style={styles.section}>
          <SectionTitle>Foul points go to</SectionTitle>
          <Segmented
            label="Foul points go to"
            value={distribution}
            onChange={setDistribution}
            options={[
              { value: 'next', label: 'Next player' },
              { value: 'all', label: 'All others' },
              { value: 'manual', label: 'I choose' },
            ]}
          />
          <AppText variant="caption" tone="muted">
            {DISTRIBUTION_HELP[distribution]}
          </AppText>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>Reds</SectionTitle>
        <Segmented
          label="Number of reds"
          value={totalReds}
          onChange={setTotalReds}
          options={REDS_OPTIONS.map((reds) => ({ value: reds as number, label: `${reds} reds` }))}
        />
        <AppText variant="caption" tone="muted">
          {totalReds === 15
            ? 'International standard: 15 reds, maximum break 147.'
            : `Short format: ${totalReds} reds, ${totalReds * 8 + 27} points on the table.`}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.sm },
  players: { gap: space.sm, padding: space.md },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  order: { width: 22, textAlign: 'center', fontWeight: '700', fontSize: 15 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 2,
  },
  playerActions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  footer: { gap: space.sm },
});
