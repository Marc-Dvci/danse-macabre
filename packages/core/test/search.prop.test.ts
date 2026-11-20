// Property tests for phrase search: Requirement 4.3 (a cut phrase is found at its own beat) and 4.4 (mirror search).
// Phrase search matches direction symbols only (decision D7 in the spec design), so the beat a cut is expected at is
// the start of its first direction symbol, not the start of a turn sign that may come before it.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { directionSymbols, findPhrase, mirrorScore, type Score } from '../src/index';
import { runOptions } from './generators';
import { cutPhrase, genScore } from './lesson-generators';

const RUNS = 200;

/** Start beat of the first direction symbol of a phrase cut from `from`. Undefined when the cut has no direction symbol. */
function searchedAnchor(from: number, phrase: Score): number | undefined {
  const starts = directionSymbols(phrase).map((s) => s.start);
  return starts.length === 0 ? undefined : from + Math.min(...starts);
}

describe('Requirement 4.3: a phrase cut from a score is found at its own start beat', () => {
  it('findPhrase(score, cut) contains the beat the cut starts at, unless an earlier kept match overlaps it (D6)', () => {
    fc.assert(
      fc.property(
        genScore.filter((s) => s.symbols.length > 0),
        fc.nat(),
        fc.double({ min: 0.5, max: 4, noNaN: true }),
        (score, index, length) => {
          const from = score.symbols[index % score.symbols.length]!.start;
          const phrase = cutPhrase(score, from, length);
          const anchor = searchedAnchor(from, phrase);
          if (anchor === undefined) return; // Nothing for phrase search to match.
          const matches = findPhrase(score, phrase).filter((m) => !m.mirrored);
          expect(containsOrOverlapped(matches, anchor, directionSymbols(phrase))).toBe(true);
        },
      ),
      runOptions(RUNS),
    );
  });
});

describe('Requirement 4.4: the mirror of a cut phrase is found with mirror: true and flagged mirrored', () => {
  it('findPhrase(score, mirror(cut), { mirror: true }) contains { beat, mirrored: true }, unless overlapped (D6)', () => {
    fc.assert(
      fc.property(
        genScore.filter((s) => s.symbols.length > 0),
        fc.nat(),
        fc.double({ min: 0.5, max: 4, noNaN: true }),
        (score, index, length) => {
          const from = score.symbols[index % score.symbols.length]!.start;
          const cut = cutPhrase(score, from, length);
          const anchor = searchedAnchor(from, cut);
          if (anchor === undefined) return; // Nothing for phrase search to match.
          const mirrored = mirrorScore(cut);
          const matches = findPhrase(score, mirrored, { mirror: true }).filter((m) => m.mirrored);
          expect(containsOrOverlapped(matches, anchor, directionSymbols(cut))).toBe(true);
        },
      ),
      runOptions(RUNS),
    );
  });
});

/**
 * True when `beat` is a kept match, or when an earlier kept match of the same phrase covers it. Requirement 2.3 drops a
 * match that overlaps an earlier kept one, so a cut that repeats itself can lose its own beat. See design decision D6.
 */
function containsOrOverlapped(
  matches: { beat: number }[],
  beat: number,
  phraseSymbols: { start: number; duration: number }[],
): boolean {
  if (matches.some((m) => Math.abs(m.beat - beat) < 1e-9)) return true;
  const origin = Math.min(...phraseSymbols.map((s) => s.start));
  const extent = Math.max(...phraseSymbols.map((s) => s.start + s.duration)) - origin;
  return matches.some((m) => m.beat < beat && beat < m.beat + extent);
}
