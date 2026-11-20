// Example tests for phrase search (Requirement 2).
import { describe, expect, it } from 'vitest';
import { canonicalScore, findPhrase, mirrorScore, type Score, type Symbol } from '../src/index';

function score(symbols: Symbol[]): Score {
  return canonicalScore({
    version: 1,
    title: 'search',
    tempo: 100,
    beatsPerBar: 4,
    grid: 0.5,
    startPosition: {},
    symbols,
  });
}

const armPair = (leftStart: number, rightStart: number, id: string): Symbol[] => [
  { id: `la-${id}`, column: 'left-arm', start: leftStart, duration: 1, direction: 'forward', level: 'high' },
  { id: `ra-${id}`, column: 'right-arm', start: rightStart, duration: 1, direction: 'place', level: 'low' },
];

// The phrase: left arm forward high at beat 0, right arm down at beat 0.5.
const phrase = score(armPair(0, 0.5, 'p'));

describe('findPhrase: matching', () => {
  it('finds every start beat of a phrase that occurs in the score', () => {
    const s = score([...armPair(0, 0.5, 'a'), ...armPair(4, 4.5, 'b')]);
    expect(findPhrase(s, phrase)).toEqual([
      { beat: 0, mirrored: false },
      { beat: 4, mirrored: false },
    ]);
  });

  it('accepts a relative start within the tolerance and rejects one outside it', () => {
    const near = score(armPair(2, 2.9, 'n'));
    const far = score(armPair(2, 3.2, 'f'));
    expect(findPhrase(near, phrase)).toEqual([{ beat: 2, mirrored: false }]);
    expect(findPhrase(far, phrase)).toEqual([]);
    expect(findPhrase(far, phrase, { tolerance: 1 })).toEqual([{ beat: 2, mirrored: false }]);
  });

  it('rejects a match where a direction or level differs', () => {
    const s = score([
      { id: 'x', column: 'left-arm', start: 0, duration: 1, direction: 'backward', level: 'high' },
      { id: 'y', column: 'right-arm', start: 0.5, duration: 1, direction: 'place', level: 'low' },
    ]);
    expect(findPhrase(s, phrase)).toEqual([]);
  });

  it('ignores symbols in columns the phrase does not use', () => {
    const s = score([
      ...armPair(0, 0.5, 'a'),
      { id: 'extra', column: 'left-leg', start: 0, duration: 1, direction: 'place', level: 'high' },
    ]);
    expect(findPhrase(s, phrase)).toEqual([{ beat: 0, mirrored: false }]);
  });

  it('returns no matches for an empty phrase', () => {
    expect(findPhrase(score(armPair(0, 0.5, 'a')), score([]))).toEqual([]);
  });
});

describe('findPhrase: overlaps', () => {
  it('drops a match that starts before the previous match of the phrase has ended', () => {
    // A two-beat phrase in one column. The score has the same cell at beats 0 and 1, so the second match overlaps.
    const twoBeat = score([{ id: 'p', column: 'left-arm', start: 0, duration: 2, direction: 'forward', level: 'high' }]);
    const s = score([
      { id: 'a', column: 'left-arm', start: 0, duration: 1, direction: 'forward', level: 'high' },
      { id: 'b', column: 'left-arm', start: 1, duration: 1, direction: 'forward', level: 'high' },
      { id: 'c', column: 'left-arm', start: 2, duration: 1, direction: 'forward', level: 'high' },
    ]);
    expect(findPhrase(s, twoBeat).map((m) => m.beat)).toEqual([0, 2]);
  });

  it('keeps the earlier of two overlapping occurrences (shrunk counterexample for D6)', () => {
    // Phrase: two place-high symbols in right-support, half a beat each. Score: the same cell at beats 0, 0.5 and 1.
    // The phrase occurs at 0 and at 0.5. The two occurrences overlap, so only beat 0 is kept.
    const cell = (id: string, start: number) => ({
      id,
      column: 'right-support' as const,
      start,
      duration: 0.5,
      direction: 'place' as const,
      level: 'high' as const,
    });
    const s = score([cell('a', 0), cell('b', 0.5), cell('c', 1)]);
    const pair = score([cell('p', 0), cell('q', 0.5)]);
    expect(findPhrase(s, pair)).toEqual([{ beat: 0, mirrored: false }]);
  });
});

describe('findPhrase: mirror', () => {
  it('finds the mirror of a phrase only when mirror is set, and flags it', () => {
    const s = score([...armPair(0, 0.5, 'a')]);
    const mirrored = mirrorScore(phrase);
    expect(findPhrase(s, mirrored)).toEqual([]);
    expect(findPhrase(s, mirrored, { mirror: true })).toEqual([{ beat: 0, mirrored: true }]);
  });

  it('returns only the mirrored matches when the phrase itself does not occur', () => {
    const s = score([...armPair(0, 0.5, 'a'), ...armPair(4, 4.5, 'b')]);
    const both = findPhrase(s, mirrorScore(phrase), { mirror: true });
    expect(both).toEqual([
      { beat: 0, mirrored: true },
      { beat: 4, mirrored: true },
    ]);
  });
});
