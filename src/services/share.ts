/**
 * Sharing match results as text or as an image, on phones and in browsers.
 */
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type ShareOutcome = 'shared' | 'copied' | 'saved' | 'cancelled' | 'failed';

/** A ref to a mounted `<View>`. */
export type ViewRef = RefObject<ComponentRef<typeof View> | null>;

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

/** Opens the system share sheet with the text; falls back to the clipboard in browsers without one. */
export async function shareText(text: string): Promise<ShareOutcome> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ text });
          return 'shared';
        } catch (error) {
          if (isAbort(error)) return 'cancelled';
        }
      }
      return (await copyText(text)) ? 'copied' : 'failed';
    }
    const result = await Share.share({ message: text });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'failed';
  }
}

/** Captures a view as a PNG and shares it (or downloads it in a desktop browser). */
export async function shareImage(view: ViewRef, fileName: string): Promise<ShareOutcome> {
  try {
    if (Platform.OS === 'web') {
      const dataUri = await captureRef(view, { format: 'png', quality: 1, result: 'data-uri' });
      const blob = await (await fetch(dataUri)).blob();
      const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return 'shared';
        } catch (error) {
          if (isAbort(error)) return 'cancelled';
        }
      }
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return 'saved';
    }

    const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
    if (!(await Sharing.isAvailableAsync())) return 'failed';
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share match result', UTI: 'public.png' });
    return 'shared';
  } catch {
    return 'failed';
  }
}

export function outcomeMessage(outcome: ShareOutcome): string | null {
  switch (outcome) {
    case 'copied':
      return 'Result copied to the clipboard';
    case 'saved':
      return 'Image saved to your downloads';
    case 'failed':
      return 'Sharing is not available on this device';
    case 'shared':
    case 'cancelled':
      return null;
  }
}
