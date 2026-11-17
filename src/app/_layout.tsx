import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogProvider } from '@/components/ui/Dialog';
import { PortalProvider } from '@/components/ui/Portal';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { preloadSounds } from '@/services/feedback';
import { app, useApp } from '@/store';
import { useTheme } from '@/theme';

// Keep the splash screen up until saved matches have been read from storage.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const theme = useTheme();
  const hydrated = useApp((state) => state.hydrated);

  useEffect(() => {
    app()
      .hydrate()
      .finally(() => {
        preloadSounds();
        void SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.bg).catch(() => {});
  }, [theme.bg]);

  // Make sure the latest action is on disk whenever the app is interrupted:
  // a phone call, switching apps, locking the screen or closing the tab.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') void app().flush();
    });
    let removeWebListener = () => {};
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onHide = () => void app().flush();
      window.addEventListener('pagehide', onHide);
      removeWebListener = () => window.removeEventListener('pagehide', onHide);
    }
    return () => {
      subscription.remove();
      removeWebListener();
    };
  }, []);

  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, background: theme.bg, card: theme.bg, text: theme.text, border: theme.border, primary: theme.accent },
  };

  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <PortalProvider>
          <ToastProvider>
            <DialogProvider>
              <StatusBar style={theme.dark ? 'light' : 'dark'} />
              <StorageWarning />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.bg },
                  animation: 'slide_from_right',
                }}
              />
            </DialogProvider>
          </ToastProvider>
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Tells the user if a save could not be written (for example when storage is full). */
function StorageWarning() {
  const error = useApp((state) => state.storageError);
  const toast = useToast();
  useEffect(() => {
    if (error) {
      toast.show({
        message: `Could not save to this device: ${error}. Free up some space to keep your matches safe.`,
        tone: 'warning',
        duration: 8000,
      });
    }
  }, [error, toast]);
  return null;
}
