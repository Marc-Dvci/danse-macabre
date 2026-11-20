import { isTurnSymbol } from './symbol';
import type { ColumnId, Direction, Level, Cell, Score, Symbol, ValidationResult } from './types';

/** Gesture columns, in the order the notator writes them. */
export const GESTURE_COLUMNS: readonly ColumnId[] = ['left-leg', 'right-leg', 'left-arm', 'right-arm'];

/** Canonical column order: left side from the centre line outward, then right side. */
export const COLUMN_ORDER: readonly ColumnId[] = [
  'left-support',
  'left-leg',
  'left-arm',
  'right-support',
  'right-leg',
  'right-arm',
];

export const DIRECTIONS: readonly Direction[] = [
  'place',
  'forward',
  'backward',
  'left',
  'right',
  'left-forward',
  'right-forward',
  'left-backward',
  'right-backward',
];

export const LEVELS: readonly Level[] = ['high', 'middle', 'low'];

/** Amounts a turn sign can carry, as fractions of a full turn. */
export const TURN_AMOUNTS: readonly number[] = [0.25, 0.5, 0.75, 1];

const TOLERANCE = 1e-6;

function isMultiple(x: number, grid: number): boolean {
  const q = x / grid;
  return Math.abs(q - Math.round(q)) < TOLERANCE;
}

function checkCell(cell: Cell, column: ColumnId | null, where: string, errors: string[]): void {
  if (!DIRECTIONS.includes(cell.direction)) errors.push(`${where}: unknown direction "${cell.direction}"`);
  if (!LEVELS.includes(cell.level)) errors.push(`${where}: unknown level "${cell.level}"`);
  const isGesture = column !== null && GESTURE_COLUMNS.includes(column);
  if (isGesture && cell.direction === 'place' && cell.level === 'middle') {
    errors.push(`${where}: "place middle" is not a gesture direction`);
  }
}

function checkTurn(s: Symbol & { kind: 'turn' }, where: string, errors: string[]): void {
  if (s.column !== 'left-support' && s.column !== 'right-support') {
    errors.push(`${where}: a turn sign must be in a support column, not "${s.column}"`);
  }
  if (s.rotation !== 'cw' && s.rotation !== 'ccw') errors.push(`${where}: unknown rotation "${s.rotation}"`);
  if (!TURN_AMOUNTS.includes(s.amount)) errors.push(`${where}: amount ${s.amount} is not 0.25, 0.5, 0.75 or 1`);
}

/**
 * Checks a score against Requirement 1.3 and the turn rules of supports-and-turns. Returns one error string per
 * violation.
 * @param score Any object of the Score shape.
 * @returns `{ ok: true }` when no violation exists, otherwise `{ ok: false, errors }`.
 */
export function validateScore(score: Score): ValidationResult {
  const errors: string[] = [];
  if (!(score.tempo > 0)) errors.push(`tempo must be positive, got ${score.tempo}`);
  if (!(score.grid > 0)) {
    errors.push(`grid must be positive, got ${score.grid}`);
    return { ok: false, errors };
  }

  for (const [column, cell] of Object.entries(score.startPosition)) {
    const known = COLUMN_ORDER.includes(column as ColumnId);
    if (!known) errors.push(`startPosition: unknown column "${column}"`);
    if (cell) checkCell(cell, known ? (column as ColumnId) : null, `startPosition.${column}`, errors);
  }

  const seenIds = new Set<string>();
  const byColumn = new Map<string, Symbol[]>();
  for (const s of score.symbols) {
    const where = `symbol "${s.id}"`;
    if (seenIds.has(s.id)) errors.push(`${where}: duplicate id`);
    seenIds.add(s.id);

    const knownColumn = COLUMN_ORDER.includes(s.column);
    if (!knownColumn) errors.push(`${where}: unknown column "${s.column}"`);
    if (isTurnSymbol(s)) {
      checkTurn(s, where, errors);
    } else {
      checkCell({ direction: s.direction, level: s.level }, knownColumn ? s.column : null, where, errors);
    }

    if (!isMultiple(s.start, score.grid)) errors.push(`${where}: start ${s.start} is not a multiple of grid`);
    if (!isMultiple(s.duration, score.grid)) errors.push(`${where}: duration ${s.duration} is not a multiple of grid`);
    if (s.duration < score.grid - TOLERANCE) {
      errors.push(`${where}: duration ${s.duration} is below one grid (${score.grid})`);
    }
    if (knownColumn) {
      const list = byColumn.get(s.column) ?? [];
      list.push(s);
      byColumn.set(s.column, list);
    }
  }

  for (const [column, list] of byColumn) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const next = sorted[i]!;
      if (prev.start + prev.duration > next.start + TOLERANCE) {
        errors.push(`column ${column}: symbols "${prev.id}" and "${next.id}" overlap in time`);
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function columnRank(column: string): number {
  const i = COLUMN_ORDER.indexOf(column as ColumnId);
  return i === -1 ? COLUMN_ORDER.length : i;
}

/** Writes one symbol with its keys in a fixed order. Direction symbols never get a `kind` key. */
function canonicalSymbol(s: Symbol): Symbol {
  if (isTurnSymbol(s)) {
    return {
      id: s.id,
      kind: 'turn',
      column: s.column,
      start: s.start,
      duration: s.duration,
      rotation: s.rotation,
      amount: s.amount,
    };
  }
  return {
    id: s.id,
    column: s.column,
    start: s.start,
    duration: s.duration,
    direction: s.direction,
    level: s.level,
  };
}

/**
 * Returns the score with symbols sorted by column (see COLUMN_ORDER), then start, then duration. Object keys are
 * built in a fixed order, so equal scores serialise to the same JSON.
 * @param score A score. It is not modified.
 */
export function canonicalScore(score: Score): Score {
  const symbols = [...score.symbols]
    .sort(
      (a, b) =>
        columnRank(a.column) - columnRank(b.column) || a.start - b.start || a.duration - b.duration,
    )
    .map(canonicalSymbol);

  const startPosition: Partial<Record<ColumnId, Cell>> = {};
  for (const column of COLUMN_ORDER) {
    const cell = score.startPosition[column];
    if (cell) startPosition[column] = { direction: cell.direction, level: cell.level };
  }

  const result: Score = {
    version: 1,
    title: score.title,
    tempo: score.tempo,
    beatsPerBar: score.beatsPerBar,
    grid: score.grid,
    startPosition,
    symbols,
  };
  if (score.source !== undefined) result.source = score.source;
  return result;
}
