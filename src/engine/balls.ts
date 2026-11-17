import type { BallId, ColourId } from './types';

/** International standard ball values. */
export const BALL_VALUES: Record<BallId, number> = {
  red: 1,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7,
};

/** Colours in the order they must be potted once the reds are gone. */
export const COLOUR_ORDER: readonly ColourId[] = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];

export const ALL_BALLS: readonly BallId[] = ['red', ...COLOUR_ORDER];

export const BALL_NAMES: Record<BallId, string> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  brown: 'Brown',
  blue: 'Blue',
  pink: 'Pink',
  black: 'Black',
};

/** Yellow through black: 2 + 3 + 4 + 5 + 6 + 7. */
export const COLOURS_TOTAL = 27;

export const MIN_FOUL = 4;
export const MAX_FOUL = 7;

/** Highest break possible without a free ball in a 15-red frame. */
export const MAXIMUM_BREAK = 147;

export const STANDARD_REDS = 15;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export function isColour(ball: BallId): ball is ColourId {
  return ball !== 'red';
}
