import { canonicalScore, validateScore } from '@danse/core';
import type { Cell, ColumnId, Direction, Level, Score, Symbol } from '@danse/core';

/** A move written by an agent. `count` is 1-based across the whole phrase; `counts` is the length in counts. */
export type Move =
  | { count: number; column: ColumnId; direction: Direction; level: Level; counts: number }
  | {
      count: number;
      column: ColumnId;
      turn: 'cw' | 'ccw';
      amount: 0.25 | 0.5 | 0.75 | 1;
      counts: number;
    };

export type ComposeInput = {
  title: string;
  tempo: number;
  beatsPerBar: number;
  grid: number;
  startPosition?: Partial<Record<ColumnId, Cell>>;
  moves: Move[];
};

export type ComposeResult = { ok: true; score: Score } | { ok: false; errors: string[] };

/** Turn signs are written in the support columns only (supports-and-turns rules). */
function isSupportColumn(column: ColumnId): column is 'left-support' | 'right-support' {
  return column === 'left-support' || column === 'right-support';
}

/** Turns one move into a symbol. Its id is `m<position>-<column>`, where position is 1-based in the input list. */
function toSymbol(move: Move, position: number): Symbol {
  const id = `m${position}-${move.column}`;
  const start = move.count - 1;
  if ('turn' in move) {
    if (!isSupportColumn(move.column)) {
      throw new RangeError(`turn move in column ${move.column}: a turn sign must be in a support column`);
    }
    return {
      id,
      kind: 'turn',
      column: move.column,
      start,
      duration: move.counts,
      rotation: move.turn,
      amount: move.amount,
    };
  }
  return {
    id,
    column: move.column,
    start,
    duration: move.counts,
    direction: move.direction,
    level: move.level,
  };
}

/**
 * Writes a phrase from moves (Requirement 1.1). Each move starts at `count - 1` beats. The result is canonical and passes
 * `validateScore`, or the errors are returned.
 * @param input Metre, tempo, grid, optional starting position, and the moves in any order.
 * @returns `{ ok: true, score }` or `{ ok: false, errors }` with one string per problem.
 */
export function composeScore(input: ComposeInput): ComposeResult {
  const errors: string[] = [];
  if (!Number.isInteger(input.beatsPerBar) || input.beatsPerBar < 1) {
    errors.push(`beatsPerBar must be a positive integer, got ${input.beatsPerBar}`);
  }
  input.moves.forEach((move, i) => {
    const where = `move ${i + 1} (${move.column})`;
    if (!Number.isInteger(move.count) || move.count < 1) {
      errors.push(`${where}: count must be a whole number from 1, got ${move.count}`);
    }
    if ('turn' in move && !isSupportColumn(move.column)) {
      errors.push(`${where}: a turn sign must be in a support column, not "${move.column}"`);
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const score: Score = {
    version: 1,
    title: input.title,
    tempo: input.tempo,
    beatsPerBar: input.beatsPerBar,
    grid: input.grid,
    startPosition: input.startPosition ?? {},
    symbols: input.moves.map((move, i) => toSymbol(move, i + 1)),
  };

  const check = validateScore(score);
  if (!check.ok) return { ok: false, errors: check.errors };
  return { ok: true, score: canonicalScore(score) };
}
