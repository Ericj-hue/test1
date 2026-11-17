/**
 * Sound effects and vibration. Both can be switched off in Settings, and
 * every call is safe to make on any platform - failures are swallowed so a
 * missing speaker or vibration motor can never interrupt scoring.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { appStore } from '@/store';

const SOURCES = {
  pot: require('../../assets/sounds/pot.wav'),
  miss: require('../../assets/sounds/miss.wav'),
  foul: require('../../assets/sounds/foul.wav'),
  undo: require('../../assets/sounds/undo.wav'),
  milestone: require('../../assets/sounds/milestone.wav'),
  win: require('../../assets/sounds/win.wav'),
} as const;

type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let audioConfigured = false;

function playerFor(name: SoundName): AudioPlayer | null {
  try {
    if (!audioConfigured) {
      audioConfigured = true;
      // Respect the phone's silent switch and never interrupt music that is playing.
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      players[name] = player;
    }
    return player;
  } catch {
    return null;
  }
}

/** Loads the sound files ahead of time so the first tap is not delayed. */
export function preloadSounds(): void {
  for (const name of Object.keys(SOURCES) as SoundName[]) playerFor(name);
}

function play(name: SoundName): void {
  if (!appStore.getState().settings.sound) return;
  const player = playerFor(name);
  if (!player) return;
  try {
    void Promise.resolve(player.seekTo(0)).catch(() => {});
    player.play();
  } catch {
    // Audio is a nicety; ignore playback problems.
  }
}

type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 18,
  heavy: 30,
  success: [14, 50, 22],
  warning: [24, 60, 24],
  error: [36, 50, 36],
};

function vibrate(kind: HapticKind): void {
  if (!appStore.getState().settings.haptics) return;
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(WEB_PATTERNS[kind]);
      }
      return;
    }
    switch (kind) {
      case 'light':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        break;
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        break;
    }
  } catch {
    // Vibration is optional.
  }
}

export const feedback = {
  pot() {
    play('pot');
    vibrate('medium');
  },
  endTurn() {
    play('miss');
    vibrate('light');
  },
  foul() {
    play('foul');
    vibrate('error');
  },
  undo() {
    play('undo');
    vibrate('light');
  },
  /** A ball was tapped that cannot be scored right now. */
  blocked() {
    vibrate('warning');
  },
  milestone() {
    play('milestone');
    vibrate('success');
  },
  frameWon() {
    play('win');
    vibrate('success');
  },
  tap() {
    vibrate('light');
  },
};
