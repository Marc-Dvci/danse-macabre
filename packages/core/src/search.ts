import { mirrorScore } from './mirror';
import { COLUMN_ORDER } from './score';
import { directionSymbols } from './symbol';
import type { ColumnId, DirectionSymbol, Score } from './types';

/** One place where a phrase occurs. `beat` is the start of the phrase in the score. */
export type PhraseMatch = { beat: number; mirrored: boolean };

export type FindPhraseOptions = {
  /** Largest difference in beats between a symbol's relative start in the phrase and in the score. Default 0.5. */
  tolerance?: number;
  /** Also search for the mirrored phrase and flag its matches `mirrored: true`. Default false. */
  mirror?: boolean;
};

const EPS = 1e-9;

function columnRank(column: ColumnId): number {
  return COLUMN_ORDER.indexOf(column);
}

/** Start beats where the phrase matches. The phrase is matched once, without mirroring. */
function matchBeats(score: Score, phrase: Score, tolerance: number): number[] {
  const phraseSymbols = directionSymbols(phrase);
  if (phraseSymbols.length === 0) return [];
  const origin = Math.min(...phraseSymbols.map((s) => s.start));

  const phraseByColumn = new Map<ColumnId, DirectionSymbol[]>();
  for (const s of phraseSymbols) {
    const list = phraseByColumn.get(s.column) ?? [];
    list.push(s);
    phraseByColumn.set(s.column, list);
  }
  for (const list of phraseByColumn.values()) list.sort((a, b) => a.start - b.start);

  const scoreByColumn = new Map<ColumnId, DirectionSymbol[]>();
  for (const s of directionSymbols(score)) {
    const list = scoreByColumn.get(s.column) ?? [];
    list.push(s);
    scoreByColumn.set(s.column, list);
  }
  for (const list of scoreByColumn.values()) list.sort((a, b) => a.start - b.start);

  // The earliest phrase symbol fixes the candidate beats: each start of a score symbol in its column.
  const earliest = [...phraseSymbols].sort(
    (a, b) => a.start - b.start || columnRank(a.column) - columnRank(b.column),
  )[0]!;
  const candidates = [...new Set((scoreByColumn.get(earliest.column) ?? []).map((s) => s.start))];

  return candidates.filter((b) => {
    for (const [column, want] of phraseByColumn) {
      const have = (scoreByColumn.get(column) ?? []).filter((s) => s.start >= b - EPS);
      if (have.length < want.length) return false;
      for (let k = 0; k < want.length; k++) {
        const p = want[k]!;
        const s = have[k]!;
        if (s.direction !== p.direction || s.level !== p.level) return false;
        if (Math.abs(s.start - b - (p.start - origin)) > tolerance + EPS) return false;
      }
    }
    return true;
  });
}

/** Keeps matches in beat order and drops any that starts before the previous kept match has ended. */
function withoutOverlaps(beats: number[], extent: number): number[] {
  const kept: number[] = [];
  for (const b of beats) {
    const last = kept[kept.length - 1];
    if (last !== undefined && b < last + extent - EPS) continue;
    kept.push(b);
  }
  return kept;
}

/**
 * Finds where a phrase occurs in a score (Requirement 2). A match at beat `b` means: for every column the phrase uses,
 * the score's symbols from `b` on begin with the phrase's symbols, in order, with the same direction and level, and each
 * symbol starts within `tolerance` beats of its relative position in the phrase. Durations and symbols after the phrase
 * are not compared. Matches of one phrase do not overlap: a match is dropped when it starts before the previous kept
 * match ends.
 * @param score The score to search. It is not modified.
 * @param phrase A phrase score. Only its symbols are used.
 * @param options `tolerance` (default 0.5 beats) and `mirror` (default false).
 * @returns Matches sorted by beat. Original matches come before mirrored matches at the same beat.
 */
export function findPhrase(score: Score, phrase: Score, options: FindPhraseOptions = {}): PhraseMatch[] {
  const tolerance = options.tolerance ?? 0.5;
  const kinds: { mirrored: boolean; phrase: Score }[] = [{ mirrored: false, phrase }];
  if (options.mirror) kinds.push({ mirrored: true, phrase: mirrorScore(phrase) });

  const out: PhraseMatch[] = [];
  for (const kind of kinds) {
    const symbols = kind.phrase.symbols;
    if (symbols.length === 0) continue;
    const origin = Math.min(...symbols.map((s) => s.start));
    const extent = Math.max(...symbols.map((s) => s.start + s.duration)) - origin;
    const beats = withoutOverlaps(matchBeats(score, kind.phrase, tolerance), extent);
    for (const beat of beats) out.push({ beat, mirrored: kind.mirrored });
  }
  return out.sort((a, b) => a.beat - b.beat || Number(a.mirrored) - Number(b.mirrored));
}
