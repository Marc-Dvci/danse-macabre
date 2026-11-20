import type { Cell, ColumnId, Direction, DirectionSymbol, Level } from './types';

/** Words for each direction. `place` has no direction word; see `gesturePhrase` and `supportPhrase`. */
export const DIRECTION_WORDS: Record<Exclude<Direction, 'place'>, string> = {
  forward: 'forward',
  backward: 'backward',
  left: 'to your left',
  right: 'to your right',
  'left-forward': 'forward and to your left',
  'right-forward': 'forward and to your right',
  'left-backward': 'backward and to your left',
  'right-backward': 'backward and to your right',
};

export const LEVEL_WORDS: Record<Level, string> = { high: 'high', middle: 'middle', low: 'low' };

/** Support level in words: the knees and the balls of the feet, as in the lesson text. */
export const SUPPORT_LEVEL_WORDS: Record<Level, string> = {
  low: 'knees bent',
  middle: 'standing normally',
  high: 'on the balls of your feet',
};

/** Order of symbols that start on the same beat: supports, legs, then arms; left before right. */
export const LESSON_COLUMN_ORDER: readonly ColumnId[] = [
  'left-support',
  'right-support',
  'left-leg',
  'right-leg',
  'left-arm',
  'right-arm',
];

/** Body part in words: `left-arm` becomes `left arm`, `right-support` becomes `right foot`. */
export function bodyPart(column: ColumnId): string {
  return column.replace('support', 'foot').replace('-', ' ');
}

function isArmColumn(column: ColumnId): boolean {
  return column.endsWith('-arm');
}

/** Phrase for a gesture cell (arm or leg column). Throws for `place middle`, which is not a gesture. */
function gesturePhrase(column: ColumnId, cell: Cell): string {
  const part = bodyPart(column);
  if (cell.direction === 'place') {
    if (cell.level === 'high') return `${part} moves straight up`;
    if (cell.level === 'low') return isArmColumn(column) ? `${part} moves down by your side` : `${part} moves straight down`;
    throw new RangeError(`lesson: "place middle" is not a gesture (${column})`);
  }
  const verb = isArmColumn(column) ? 'moves' : 'lifts';
  return `${part} ${verb} ${DIRECTION_WORDS[cell.direction]}, ${LEVEL_WORDS[cell.level]}`;
}

/** Phrase for a support cell (a step onto one foot). */
function supportPhrase(column: ColumnId, cell: Cell): string {
  const side = column.startsWith('left') ? 'left' : 'right';
  const move = cell.direction === 'place' ? 'in place' : DIRECTION_WORDS[cell.direction];
  return `step ${move} on the ${side} foot, ${SUPPORT_LEVEL_WORDS[cell.level]}`;
}

/**
 * Phrase for one cell in one column, without the duration. Used for symbols and for the starting position.
 * @param column Column the cell is written in.
 * @param cell Direction and level.
 * @returns Words such as `right arm moves forward, high` or `step forward on the left foot, knees bent`.
 */
export function cellPhrase(column: ColumnId, cell: Cell): string {
  return column.endsWith('support') ? supportPhrase(column, cell) : gesturePhrase(column, cell);
}

/** Duration in words: `over 1 count`, `over 2 counts`, `over 0.5 counts`. */
export function durationPhrase(beats: number): string {
  return `over ${beats} ${beats === 1 ? 'count' : 'counts'}`;
}

/**
 * Phrase for a symbol with its duration, for example `right arm moves forward, high, over 2 counts`.
 * @param symbol Symbol to describe.
 */
export function symbolPhrase(symbol: DirectionSymbol): string {
  return `${cellPhrase(symbol.column, { direction: symbol.direction, level: symbol.level })}, ${durationPhrase(symbol.duration)}`;
}
