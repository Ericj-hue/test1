import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NATIVE_DRIVER, useCloseRequest } from '@/hooks/useCloseRequest';
import { MAX_CONTENT_WIDTH, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './Button';
import { Portal } from './Portal';

interface SheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling content - usually the confirm button. */
  footer?: ReactNode;
}

/** A panel that slides up from the bottom of the screen. */
export function Sheet(props: SheetProps) {
  if (!props.visible) return null;
  return (
    <Portal>
      <SheetPanel {...props} />
    </Portal>
  );
}

function SheetPanel({ title, subtitle, onClose, children, footer }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [progress]);

  useCloseRequest(onClose);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [48, 0] });

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[styles.scrim, { backgroundColor: theme.scrim, opacity: progress }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: theme.surfaceSolid,
            borderColor: theme.border,
            paddingBottom: Math.max(insets.bottom, space.md),
            marginTop: insets.top + space.xl,
            opacity: progress,
            transform: [{ translateY }],
          },
        ]}>
        <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="heading" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" tone="muted">
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <IconButton name="close" label="Close" onPress={onClose} testID="sheet-close" />
        </View>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill },
  panel: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexShrink: 1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: space.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  headerText: { flex: 1, gap: 2 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
