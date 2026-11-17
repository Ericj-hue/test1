/**
 * Confirmation and text-entry dialogs, used via hooks:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Restart frame?', destructive: true })) { ... }
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { NATIVE_DRIVER, useCloseRequest } from '@/hooks/useCloseRequest';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Portal } from './Portal';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  destructive?: boolean;
  /** Show a single acknowledgement button. */
  hideCancel?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  maxLength?: number;
  /** Digits only, with a number keypad. */
  numeric?: boolean;
}

interface DialogApi {
  confirm(options: ConfirmOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
}

type Request =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

const DialogContext = createContext<DialogApi>({
  confirm: async () => false,
  prompt: async () => null,
});

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) => new Promise<boolean>((resolve) => setRequest({ kind: 'confirm', options, resolve })),
      prompt: (options) => new Promise<string | null>((resolve) => setRequest({ kind: 'prompt', options, resolve })),
    }),
    [],
  );

  const cancel = useCallback(() => {
    setRequest((current) => {
      if (current?.kind === 'confirm') current.resolve(false);
      if (current?.kind === 'prompt') current.resolve(null);
      return null;
    });
  }, []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request ? (
        <Portal>
          {request.kind === 'confirm' ? (
            <ConfirmCard
              options={request.options}
              onCancel={cancel}
              onConfirm={() => {
                request.resolve(true);
                setRequest(null);
              }}
            />
          ) : (
            <PromptCard
              options={request.options}
              onCancel={cancel}
              onSubmit={(value) => {
                request.resolve(value);
                setRequest(null);
              }}
            />
          )}
        </Portal>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useConfirm(): DialogApi['confirm'] {
  return useContext(DialogContext).confirm;
}

export function usePrompt(): DialogApi['prompt'] {
  return useContext(DialogContext).prompt;
}

function DialogFrame({ onCancel, children }: { onCancel: () => void; children: ReactNode }) {
  const theme = useTheme();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 160, useNativeDriver: NATIVE_DRIVER }).start();
  }, [progress]);

  useCloseRequest(onCancel);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      accessibilityViewIsModal>
      <Animated.View style={[styles.scrim, { backgroundColor: theme.scrim, opacity: progress }]}>
        <Pressable style={styles.fill} onPress={onCancel} accessibilityLabel="Cancel" accessibilityRole="button" />
      </Animated.View>
      <Animated.View
        accessibilityRole="alert"
        style={[
          styles.card,
          { backgroundColor: theme.surfaceSolid, borderColor: theme.border, opacity: progress, transform: [{ scale }] },
        ]}>
        {children}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function ConfirmCard({
  options,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogFrame onCancel={onCancel}>
      <AppText variant="heading">{options.title}</AppText>
      {options.message ? <AppText tone="dim">{options.message}</AppText> : null}
      <View style={styles.actions}>
        {options.hideCancel ? null : (
          <Button label={options.cancelLabel ?? 'Cancel'} onPress={onCancel} grow testID="dialog-cancel" />
        )}
        <Button
          label={options.confirmLabel ?? 'OK'}
          variant={options.destructive ? 'danger' : 'primary'}
          onPress={onConfirm}
          grow
          testID="dialog-confirm"
        />
      </View>
    </DialogFrame>
  );
}

function PromptCard({
  options,
  onCancel,
  onSubmit,
}: {
  options: PromptOptions;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(options.initialValue ?? '');
  const trimmed = value.trim();

  return (
    <DialogFrame onCancel={onCancel}>
      <AppText variant="heading">{options.title}</AppText>
      {options.message ? <AppText tone="dim">{options.message}</AppText> : null}
      <TextInput
        value={value}
        onChangeText={(text) => setValue(options.numeric ? text.replace(/[^0-9]/g, '') : text)}
        placeholder={options.placeholder}
        placeholderTextColor={theme.textMuted}
        maxLength={options.maxLength}
        keyboardType={options.numeric ? 'number-pad' : 'default'}
        autoFocus
        autoCapitalize={options.numeric ? 'none' : 'words'}
        autoCorrect={false}
        returnKeyType="done"
        selectTextOnFocus
        onSubmitEditing={() => {
          if (trimmed) onSubmit(trimmed);
        }}
        style={[styles.input, { color: theme.text, borderColor: theme.borderStrong, backgroundColor: theme.surfaceRaised }]}
        testID="dialog-input"
      />
      <View style={styles.actions}>
        <Button label="Cancel" onPress={onCancel} grow testID="dialog-cancel" />
        <Button
          label={options.confirmLabel ?? 'Save'}
          variant="primary"
          disabled={!trimmed}
          onPress={() => onSubmit(trimmed)}
          grow
          testID="dialog-confirm"
        />
      </View>
    </DialogFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  fill: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: space.xl,
    gap: space.md,
    boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.35)',
  },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 17,
    fontWeight: '600',
  },
});
