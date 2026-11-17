import { StyleSheet, View } from 'react-native';

import { Ball } from '@/components/game/Ball';
import { AppText } from '@/components/ui/AppText';
import { Card, SectionTitle } from '@/components/ui/Controls';
import { Screen } from '@/components/ui/Screen';
import { ALL_BALLS, BALL_NAMES, BALL_VALUES } from '@/engine';
import { space, tabular, useTheme } from '@/theme';

interface Topic {
  title: string;
  points: string[];
}

const TOPICS: Topic[] = [
  {
    title: 'Order of play',
    points: [
      'A frame starts with 15 reds and six colours: 147 points are on the table.',
      'A red must be potted first. After a red, any one colour may be played.',
      'While reds remain, a potted colour goes back on its spot.',
      'After the last red, one more colour of your choice may be taken. Then the colours are potted in order: yellow, green, brown, blue, pink, black - and they stay down.',
      'Two or more reds potted in one shot each score a point. Use "+1 red, same shot".',
      'A turn ends when the player fails to pot a legal ball. Tap "End turn".',
    ],
  },
  {
    title: 'Fouls',
    points: [
      'A foul is worth the value of the ball on, or of the highest ball involved in the foul - whichever is greater.',
      'The penalty is never less than 4 and never more than 7.',
      'After a red, the ball on is the colour the player was playing. A foul before any colour is nominated is 7.',
      'Reds potted on a foul stay off the table. Colours potted on a foul go back on their spots.',
      'After a foul, the next player may ask the offender to play again. For a "foul and a miss" the balls can be put back and the shot replayed.',
    ],
  },
  {
    title: 'Free ball',
    points: [
      'If a foul leaves the next player snookered, they may nominate any ball as a free ball.',
      'A potted free ball scores the value of the ball on, then goes back on its spot.',
      'With reds on the table it counts as a red, so any colour follows. This is how a break can pass 147 (up to 155).',
      'In the colours it counts as the ball on, which stays on the table to be potted next.',
    ],
  },
  {
    title: 'Ending a frame',
    points: [
      'When only the black is left, the first score or foul ends the frame.',
      'If the scores are then level, the black is re-spotted. The players toss for the choice of who plays first, and the next score or foul wins the frame.',
      'A player may concede at any time: use "End this frame" in the menu.',
    ],
  },
  {
    title: 'Three to ten players',
    points: [
      'Players take turns in a fixed order. Each stays at the table while they keep scoring.',
      'Multiplayer snooker is played to house rules, so you choose where foul points go: to the next player (the default), to every other player, or to a player you pick each time.',
      'If two or more players tie for the lead after the final black, the black is re-spotted between them.',
      'With two players the official rules always apply.',
    ],
  },
  {
    title: 'Scoring with this app',
    points: [
      'Only balls that are legally "on" can be scored. Tapping a dimmed ball explains why, and offers to record a foul instead.',
      'Undo removes the last action, one step at a time, right back to the break-off.',
      'Use the menu to correct a score or the number of reds, change who is at the table, or award a free ball.',
      'Everything is saved after each action. Close the app whenever you like and resume later.',
    ],
  },
];

export default function RulesScreen() {
  const theme = useTheme();
  return (
    <Screen title="Rules" subtitle="International snooker - quick reference">
      <View style={styles.section}>
        <SectionTitle>Ball values</SectionTitle>
        <Card style={styles.values}>
          {ALL_BALLS.map((ball) => (
            <View key={ball} style={styles.value} accessible accessibilityLabel={`${BALL_NAMES[ball]}: ${BALL_VALUES[ball]}`}>
              <Ball ball={ball} size={34} />
              <AppText style={[styles.valueNumber, tabular]}>{BALL_VALUES[ball]}</AppText>
              <AppText variant="caption" tone="muted" style={styles.valueName} numberOfLines={1}>
                {BALL_NAMES[ball]}
              </AppText>
            </View>
          ))}
        </Card>
      </View>

      {TOPICS.map((topic) => (
        <View key={topic.title} style={styles.section}>
          <SectionTitle>{topic.title}</SectionTitle>
          <Card>
            {topic.points.map((point) => (
              <View key={point} style={styles.point}>
                <View style={[styles.bullet, { backgroundColor: theme.accent }]} />
                <AppText tone="dim" style={styles.pointText}>
                  {point}
                </AppText>
              </View>
            ))}
          </Card>
        </View>
      ))}

      <AppText variant="caption" tone="muted" center>
        A scoring aid based on the official rules of snooker. For competition play, the referee&apos;s decision is final.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  values: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.md },
  value: { alignItems: 'center', gap: 4, flex: 1 },
  valueNumber: { fontSize: 18, fontWeight: '800' },
  valueName: { fontSize: 10 },
  point: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  pointText: { flex: 1 },
});
