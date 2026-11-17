import { useId, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { BALL_NAMES, BALL_VALUES, type BallAvailability, type BallId, type BreakBall } from '@/engine';
import { NATIVE_DRIVER } from '@/hooks/useCloseRequest';
import { BALL_PAINT, noSelect, useTheme } from '@/theme';

interface BallProps {
  ball: BallId | 'cue';
  size: number;
}

/** A shaded snooker ball: lit from the top-left with a soft highlight. */
export function Ball({ ball, size }: BallProps) {
  const paint = BALL_PAINT[ball];
  // Gradient ids are global to a web page, so every ball needs its own:
  // a shared id can point at a gradient on a hidden screen, which does not paint.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const body = `ball-${uid}-body`;
  const shine = `ball-${uid}-shine`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={body} cx="36%" cy="30%" r="78%">
          <Stop offset="0" stopColor={paint.light} />
          <Stop offset="0.42" stopColor={paint.base} />
          <Stop offset="1" stopColor={paint.dark} />
        </RadialGradient>
        <RadialGradient id={shine} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="49" fill={`url(#${body})`} />
      <Ellipse cx="35" cy="27" rx="17" ry="12" fill={`url(#${shine})`} />
      <Circle cx="50" cy="50" r="48.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="1" />
    </Svg>
  );
}

/** A small flat ball for the break trail, where dozens may be on screen at once. */
export function MiniBall({ ball, size = 16 }: { ball: BreakBall | 'cue'; size?: number }) {
  const theme = useTheme();
  if (ball === 'free') {
    return (
      <View
        accessibilityLabel="Free ball"
        style={[
          styles.mini,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: theme.accent,
          },
        ]}>
        <AppText style={{ fontSize: size * 0.5, fontWeight: '800', color: theme.accent }} maxFontSizeMultiplier={1}>
          F
        </AppText>
      </View>
    );
  }
  const paint = BALL_PAINT[ball];
  return (
    <View
      accessibilityLabel={ball === 'cue' ? 'At the table' : BALL_NAMES[ball]}
      style={[
        styles.mini,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: paint.base,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.35)',
        },
      ]}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.16,
          left: size * 0.2,
          width: size * 0.3,
          height: size * 0.22,
          borderRadius: size * 0.15,
          backgroundColor: 'rgba(255,255,255,0.45)',
        }}
      />
    </View>
  );
}

interface BallButtonProps {
  ball: BallId;
  size: number;
  availability: BallAvailability;
  onPress: () => void;
  /** Called when the ball is tapped while it is not the ball on. */
  onBlockedPress?: () => void;
  /** Small counter shown on the ball (reds remaining). */
  badge?: number;
}

/** A large tappable ball on the scoring pad. */
export function BallButton({ ball, size, availability, onPress, onBlockedPress, badge }: BallButtonProps) {
  const theme = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const paint = BALL_PAINT[ball];
  const on = availability === 'on';
  const gone = availability === 'gone';

  const animateTo = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: NATIVE_DRIVER, speed: 40, bounciness: 8 }).start();

  return (
    <Pressable
      onPress={on ? onPress : onBlockedPress}
      onPressIn={() => animateTo(on ? 0.88 : 0.96)}
      onPressOut={() => animateTo(1)}
      accessibilityRole="button"
      accessibilityLabel={`${BALL_NAMES[ball]}, ${BALL_VALUES[ball]} ${BALL_VALUES[ball] === 1 ? 'point' : 'points'}`}
      accessibilityState={{ disabled: !on }}
      accessibilityHint={on ? 'Record this ball as potted' : gone ? 'No longer on the table' : 'Not the ball on'}
      testID={`ball-${ball}`}
      style={[styles.button, { width: size, height: size }]}>
      <Animated.View style={{ transform: [{ scale }], opacity: on ? 1 : gone ? 0.16 : 0.34 }}>
        <View
          style={[
            styles.shadow,
            { width: size, height: size, borderRadius: size / 2 },
            on && { boxShadow: '0px 7px 12px rgba(0, 0, 0, 0.45)' },
          ]}>
          {gone ? (
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: theme.text,
              }}
            />
          ) : (
            <Ball ball={ball} size={size} />
          )}
        </View>
        {gone ? null : (
          <View style={styles.valueWrap}>
            <AppText
              maxFontSizeMultiplier={1}
              style={[styles.value, { color: paint.ink, fontSize: Math.round(size * 0.36) }]}>
              {BALL_VALUES[ball]}
            </AppText>
          </View>
        )}
      </Animated.View>
      {badge !== undefined && !gone ? (
        <View style={[styles.badge, { backgroundColor: theme.surfaceSolid, borderColor: theme.borderStrong }]}>
          <AppText maxFontSizeMultiplier={1} style={styles.badgeText}>
            {badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mini: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  button: { alignItems: 'center', justifyContent: 'center', ...noSelect },
  shadow: { alignItems: 'center', justifyContent: 'center' },
  valueWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  value: { fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  badgeText: { fontSize: 13, fontWeight: '800' },
});
