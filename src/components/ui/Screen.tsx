import { router } from 'expo-router';
import { useId, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { MAX_CONTENT_WIDTH, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './Button';

/** Full-screen background: baize lit from above, fading to dark at the edges. */
export function Backdrop() {
  const theme = useTheme();
  // Unique per screen: gradient ids are global to a web page (see Ball.tsx).
  const id = `backdrop-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[styles.backdrop, { backgroundColor: theme.bg }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="26%" r="90%">
            <Stop offset="0" stopColor={theme.backdrop[0]} />
            <Stop offset="0.5" stopColor={theme.backdrop[1]} />
            <Stop offset="1" stopColor={theme.backdrop[2]} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

interface ScreenProps {
  title?: string;
  subtitle?: string;
  /** Hide the back arrow (home screen). */
  hideBack?: boolean;
  onBack?: () => void;
  /** Controls shown at the right of the header. */
  right?: ReactNode;
  /** Scroll the content. Turn off for screens that manage their own layout. */
  scroll?: boolean;
  /** Pinned below the content, above the bottom safe area. */
  footer?: ReactNode;
  children: ReactNode;
}

export function Screen({ title, subtitle, hideBack, onBack, right, scroll = true, footer, children }: ScreenProps) {
  const theme = useTheme();
  const showHeader = !!title || !hideBack || !!right;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Backdrop />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.column}>
          {showHeader ? (
            <View style={styles.header}>
              <View style={styles.headerSide}>
                {hideBack ? null : <IconButton name="back" label="Back" onPress={onBack ?? goBack} testID="back" />}
              </View>
              <View style={styles.headerTitle}>
                {title ? (
                  <AppText variant="heading" numberOfLines={1} center accessibilityRole="header">
                    {title}
                  </AppText>
                ) : null}
                {subtitle ? (
                  <AppText variant="caption" tone="muted" numberOfLines={1} center>
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
            </View>
          ) : null}

          {scroll ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.flex}>{children}</View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  safe: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: space.sm,
  },
  headerSide: { minWidth: 52, flexDirection: 'row', alignItems: 'center' },
  headerRight: { justifyContent: 'flex-end' },
  headerTitle: { flex: 1, paddingHorizontal: space.xs },
  scrollContent: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
});
