import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card, Divider, ListRow, SectionTitle, Segmented, SwitchRow } from '@/components/ui/Controls';
import { useConfirm } from '@/components/ui/Dialog';
import { Screen } from '@/components/ui/Screen';
import { useToast } from '@/components/ui/Toast';
import { feedback } from '@/services/feedback';
import { app, useApp, type ThemeName } from '@/store';
import { space, THEME_LABELS } from '@/theme';
import { plural } from '@/utils/format';

const THEME_OPTIONS = (Object.keys(THEME_LABELS) as ThemeName[]).map((value) => ({ value, label: THEME_LABELS[value] }));

export default function SettingsScreen() {
  const settings = useApp((state) => state.settings);
  const matchCount = useApp((state) => state.matches.length);
  const profileCount = useApp((state) => state.profiles.length);
  const confirm = useConfirm();
  const toast = useToast();

  const clearAll = async () => {
    const confirmed = await confirm({
      title: 'Delete all data?',
      message: `This removes ${plural(matchCount, 'match', 'matches')} and ${plural(profileCount, 'player')} from this device, including any match in progress. It cannot be undone.`,
      confirmLabel: 'Delete everything',
      destructive: true,
    });
    if (!confirmed) return;
    app().clearAllData();
    toast.show({ message: 'All data deleted' });
  };

  return (
    <Screen title="Settings">
      <View style={styles.section}>
        <SectionTitle>While scoring</SectionTitle>
        <Card style={styles.card}>
          <SwitchRow
            icon="sound"
            title="Sound effects"
            description="A click for pots, fouls and the end of a turn."
            value={settings.sound}
            onChange={(value) => {
              app().updateSettings({ sound: value });
              if (value) feedback.pot();
            }}
          />
          <Divider />
          <SwitchRow
            icon="phone"
            title="Vibration"
            description="A short buzz to confirm each action."
            value={settings.haptics}
            onChange={(value) => {
              app().updateSettings({ haptics: value });
              if (value) feedback.tap();
            }}
          />
          <Divider />
          <SwitchRow
            icon="screen"
            title="Keep the screen on"
            description="Stops the phone locking during a frame."
            value={settings.keepAwake}
            onChange={(value) => app().updateSettings({ keepAwake: value })}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Appearance</SectionTitle>
        <Segmented label="Theme" options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => app().updateSettings({ theme })} />
        <AppText variant="caption" tone="muted">
          Baize green is the classic table look. Dark is pure black for dim rooms. Light is easiest to read in daylight.
        </AppText>
      </View>

      {Platform.OS === 'web' ? (
        <View style={styles.section}>
          <SectionTitle>Install on your phone</SectionTitle>
          <Card>
            <AppText variant="strong">iPhone or iPad</AppText>
            <AppText tone="dim">{'Open this page in Safari, tap Share, then "Add to Home Screen".'}</AppText>
            <AppText variant="strong">Android</AppText>
            <AppText tone="dim">{'Open the browser menu and choose "Install app" or "Add to Home screen".'}</AppText>
            <AppText variant="caption" tone="muted">
              Once installed it opens full screen and works without an internet connection.
            </AppText>
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>Help</SectionTitle>
        <Card style={styles.card}>
          <ListRow
            icon="book"
            title="Rules and scoring guide"
            description="Ball values, fouls, free balls and tie-breaks."
            onPress={() => router.push('/rules')}
            showChevron
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Your data</SectionTitle>
        <Card style={styles.card}>
          <ListRow
            icon="save"
            title="Stored on this device only"
            description={`${plural(matchCount, 'match', 'matches')} and ${plural(profileCount, 'player')}. Saved automatically after every action.`}
          />
          <Divider />
          <ListRow icon="trash" title="Delete all data" destructive onPress={clearAll} testID="clear-data" />
        </Card>
      </View>

      <AppText variant="caption" tone="muted" center>
        Snooker Scoreboard {Constants.expoConfig?.version ?? '1.0.0'}
        {'\n'}Free to use. No account, no adverts, no subscription.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  card: { gap: space.xs, paddingVertical: space.sm },
});
