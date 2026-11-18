import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export type Habit = { id: string; name: string };

type Saved = {
  habits: Habit[];
  /** Ticked habit ids, keyed by local date (YYYY-MM-DD). */
  log: Record<string, string[]>;
};

const STORAGE_KEY = 'lift-habits/v1';
const KEEP_DAYS = 90;

export const DEFAULT_HABITS: Habit[] = [
  { id: 'train', name: 'Train: hit the main lift' },
  { id: 'warmup', name: 'Warm-up & mobility (10 min)' },
  { id: 'log', name: 'Log sets, reps & RPE' },
  { id: 'protein', name: 'Hit protein target' },
  { id: 'water', name: 'Drink 3 L of water' },
  { id: 'sleep', name: 'Sleep 8 hours' },
  { id: 'steps', name: '8,000 steps' },
];

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function prune(log: Saved['log']): Saved['log'] {
  const keys = Object.keys(log).sort().slice(-KEEP_DAYS);
  return Object.fromEntries(keys.map((k) => [k, log[k]]));
}

/** Habits plus today's ticks, saved on the device. Ticks start fresh each day. */
export function useHabits() {
  const [loaded, setLoaded] = useState(false);
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [log, setLog] = useState<Saved['log']>({});
  const [day, setDay] = useState(todayKey());
  const skipSave = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Saved>;
        if (Array.isArray(saved.habits)) setHabits(saved.habits);
        if (saved.log && typeof saved.log === 'object') setLog(saved.log);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const data: Saved = { habits, log: prune(log) };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [loaded, habits, log]);

  // Roll over to a new day when the app comes back to the foreground, and at midnight.
  useEffect(() => {
    const refresh = () => setDay(todayKey());
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const timer = setInterval(refresh, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  const done = new Set((log[day] ?? []).filter((id) => habits.some((h) => h.id === id)));

  const toggle = useCallback(
    (id: string) => {
      setLog((prev) => {
        const current = prev[day] ?? [];
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        return { ...prev, [day]: next };
      });
    },
    [day],
  );

  const add = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setHabits((prev) => [...prev, { id, name: trimmed }]);
  }, []);

  const remove = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { loaded, habits, done, toggle, add, remove };
}
