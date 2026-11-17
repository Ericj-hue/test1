/**
 * Brief messages that appear near the top of the screen and fade away.
 * Used to confirm an undo, explain why a ball cannot be scored, and to
 * celebrate big breaks.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NATIVE_DRIVER } from '@/hooks/useCloseRequest';
import { MAX_CONTENT_WIDTH, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Portal } from './Portal';

export interface ToastOptions {
  message: string;
  tone?: 'info' | 'warning' | 'celebrate';
  /** Optional button, for example "Record foul". */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds before it disappears. */
  duration?: number;
}

interface ActiveToast extends ToastOptions {
  id: number;
}

interface ToastApi {
  show(options: ToastOptions): void;
  hide(): void;
}

const ToastContext = createContext<ToastApi>({ show: () => {}, hide: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const counter = useRef(0);

  const hide = useCallback(() => setToast(null), []);
  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    setToast({ ...options, id: counter.current });
  }, []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Portal>
          <ToastCard key={toast.id} toast={toast} onDone={hide} />
        </Portal>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

function ToastCard({ toast, onDone }: { toast: ActiveToast; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  const duration = toast.duration ?? (toast.actionLabel ? 5000 : 2600);

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: NATIVE_DRIVER }).start();
    const timer = setTimeout(() => {
      Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: NATIVE_DRIVER }).start(() => onDone());
    }, duration);
    return () => clearTimeout(timer);
  }, [progress, duration, onDone]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const celebrate = toast.tone === 'celebrate';
  const background = celebrate ? theme.accent : theme.surfaceSolid;
  const foreground = celebrate ? theme.onAccent : theme.text;
  const border = toast.tone === 'warning' ? theme.danger : celebrate ? theme.accent : theme.borderStrong;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 58 }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.card,
          { backgroundColor: background, borderColor: border, opacity: progress, transform: [{ translateY }] },
        ]}>
        <AppText style={[styles.message, { color: foreground }]}>{toast.message}</AppText>
        {toast.actionLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            onPress={() => {
              toast.onAction?.();
              onDone();
            }}
            style={({ pressed }) => [styles.action, { backgroundColor: theme.danger }, pressed && { opacity: 0.75 }]}>
            <AppText style={[styles.actionLabel, { color: theme.onDanger }]}>{toast.actionLabel}</AppText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: space.lg, pointerEvents: 'box-none' },
  card: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH - 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.35)',
  },
  message: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  action: { borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 },
  actionLabel: { fontSize: 14, fontWeight: '700' },
});
