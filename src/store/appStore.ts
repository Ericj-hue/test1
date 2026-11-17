/**
 * The application store: in-memory state plus automatic saving.
 *
 * Every action goes through the pure functions in `logic.ts`, and every
 * change is written to storage straight away - there is no "save" button to
 * forget. Storage is injected so the tests can use an in-memory store.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { FrameEvent } from '../engine';
import { makeId as defaultMakeId } from '../utils/id';
import * as logic from './logic';
import { createPersister, loadAppData, type KeyValueStorage } from './persistence';
import { EMPTY_DATA, type AppData, type NewMatchInput, type PlayerProfile, type Settings } from './types';

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface AppStore extends AppData {
  /** False until saved data has been read back from storage. */
  hydrated: boolean;
  /** Set if a save could not be written (for example when storage is full). */
  storageError: string | null;

  hydrate(): Promise<void>;
  /** Resolves when every pending save has been written. */
  flush(): Promise<void>;

  startMatch(input: NewMatchInput): ActionResult<{ matchId: string }>;
  /** Records a scoring event. Returns the reason if the rules do not allow it. */
  record(matchId: string, event: FrameEvent): ActionResult;
  undo(matchId: string): void;
  restartFrame(matchId: string): void;
  nextFrame(matchId: string, breakerId: string): ActionResult;
  finishMatch(matchId: string): void;
  deleteMatch(matchId: string): void;

  addProfile(name: string): ActionResult<{ profile: PlayerProfile }>;
  renameProfile(profileId: string, name: string): ActionResult;
  setProfileColour(profileId: string, colour: string): void;
  deleteProfile(profileId: string): void;

  updateSettings(patch: Partial<Settings>): void;
  clearAllData(): void;
}

function snapshot(state: AppStore): AppData {
  return { settings: state.settings, profiles: state.profiles, matches: state.matches };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export interface StoreOptions {
  now?: () => number;
  makeId?: (prefix?: string) => string;
}

export function createAppStore(storage: KeyValueStorage, options: StoreOptions = {}): StoreApi<AppStore> {
  const now = options.now ?? Date.now;
  const makeId = options.makeId ?? defaultMakeId;

  const store = createStore<AppStore>()((set, get) => {
    /** Runs a state transition, turning rule violations into a readable result. */
    const attempt = (transition: (data: AppData) => AppData): ActionResult => {
      try {
        set(transition(snapshot(get())));
        return { ok: true };
      } catch (error) {
        return { ok: false, error: message(error) };
      }
    };

    return {
      ...EMPTY_DATA,
      hydrated: false,
      storageError: null,

      async hydrate() {
        if (get().hydrated) return;
        const data = await loadAppData(storage);
        set({ ...data, hydrated: true });
        // From here on, every change is saved automatically.
        store.subscribe((state, previous) => persister.save(snapshot(previous), snapshot(state)));
      },

      flush: () => persister.flush(),

      startMatch(input) {
        try {
          const result = logic.startMatch(snapshot(get()), input, now(), makeId);
          set(result.data);
          return { ok: true, matchId: result.matchId };
        } catch (error) {
          return { ok: false, error: message(error) };
        }
      },

      record: (matchId, event) => attempt((data) => logic.recordMatchEvent(data, matchId, event, now())),
      undo: (matchId) => void attempt((data) => logic.undoMatchEvent(data, matchId, now())),
      restartFrame: (matchId) => void attempt((data) => logic.restartMatchFrame(data, matchId, now())),
      nextFrame: (matchId, breakerId) => attempt((data) => logic.advanceMatch(data, matchId, breakerId, now())),
      finishMatch: (matchId) => void attempt((data) => logic.completeMatch(data, matchId, now())),
      deleteMatch: (matchId) => void attempt((data) => logic.deleteMatch(data, matchId)),

      addProfile(name) {
        try {
          const result = logic.addProfile(snapshot(get()), name, now(), makeId);
          set(result.data);
          return { ok: true, profile: result.profile };
        } catch (error) {
          return { ok: false, error: message(error) };
        }
      },

      renameProfile: (profileId, name) => attempt((data) => logic.renameProfile(data, profileId, name)),
      setProfileColour: (profileId, colour) => void attempt((data) => logic.setProfileColour(data, profileId, colour)),
      deleteProfile: (profileId) => void attempt((data) => logic.deleteProfile(data, profileId)),

      updateSettings: (patch) => void attempt((data) => logic.updateSettings(data, patch)),
      clearAllData: () => set({ ...EMPTY_DATA }),
    };
  });

  const persister = createPersister(storage, (error) => {
    store.setState({ storageError: message(error) });
  });

  return store;
}
