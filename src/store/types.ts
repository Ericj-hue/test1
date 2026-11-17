import type { FoulDistribution, Match } from '../engine';

export type ThemeName = 'baize' | 'midnight' | 'light';

export interface PlayerProfile {
  id: string;
  name: string;
  /** Accent colour used for the player's badge. */
  colour: string;
  createdAt: number;
}

/** The most recent match set-up, offered as the starting point for the next one. */
export interface LastSetup {
  names: string[];
  bestOf: number;
  totalReds: number;
  foulDistribution: Exclude<FoulDistribution, 'opponent'>;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Keep the screen on while a frame is being scored. */
  keepAwake: boolean;
  theme: ThemeName;
  lastSetup: LastSetup | null;
}

export interface AppData {
  settings: Settings;
  profiles: PlayerProfile[];
  /** Every saved match: unfinished ones (with their event logs) and finished ones. */
  matches: Match[];
}

export interface NewMatchInput {
  players: { name: string; profileId: string | null }[];
  bestOf: number;
  totalReds: number;
  foulDistribution: Exclude<FoulDistribution, 'opponent'>;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  keepAwake: true,
  theme: 'baize',
  lastSetup: null,
};

export const EMPTY_DATA: AppData = {
  settings: DEFAULT_SETTINGS,
  profiles: [],
  matches: [],
};

/** Badge colours handed out to new players in turn. */
export const PROFILE_COLOURS = [
  '#E0B24A',
  '#4FA3F7',
  '#F2708B',
  '#5CC98A',
  '#B58CF5',
  '#F59B52',
  '#4DD0C7',
  '#E86A5C',
  '#9BB3C9',
  '#C9D65A',
] as const;
