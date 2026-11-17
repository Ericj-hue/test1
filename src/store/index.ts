/**
 * The app's single store instance, wired to on-device storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';

import { createAppStore, type AppStore } from './appStore';

export const appStore = createAppStore(AsyncStorage);

/** Subscribes a component to part of the store. Select stable values (not new objects). */
export function useApp<T>(selector: (state: AppStore) => T): T {
  return useStore(appStore, selector);
}

/** Store actions, callable from event handlers. */
export function app(): AppStore {
  return appStore.getState();
}

export type { ActionResult, AppStore } from './appStore';
export { cleanName, finishedMatches, findMatch, MAX_NAME_LENGTH, unfinishedMatches } from './logic';
export * from './types';
