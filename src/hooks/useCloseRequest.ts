import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/** Whether animations can run on the native thread (not available in browsers). */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Calls `onClose` when the user asks to dismiss an overlay the platform way:
 * the hardware back button on Android, or the Escape key in a browser.
 */
export function useCloseRequest(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;

    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return undefined;
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, enabled]);
}
