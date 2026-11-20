import type { DirectionSymbol, Score, Symbol, TurnSymbol } from './types';

/** True for a turn sign (`kind: 'turn'`). */
export function isTurnSymbol(s: Symbol): s is TurnSymbol {
  return s.kind === 'turn';
}

/** True for a direction symbol: any symbol that is not a turn. */
export function isDirectionSymbol(s: Symbol): s is DirectionSymbol {
  return s.kind !== 'turn';
}

/**
 * Returns the direction symbols of a score, in their stored order.
 * @param score A score. It is not modified.
 */
export function directionSymbols(score: Score): DirectionSymbol[] {
  return score.symbols.filter(isDirectionSymbol);
}
