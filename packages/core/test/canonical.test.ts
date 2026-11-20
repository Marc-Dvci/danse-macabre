import { describe, expect, it } from 'vitest';
import { canonicalScore, type Score } from '../src/index';

const a: Score = {
  version: 1,
  title: 'order',
  tempo: 60,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: { 'right-arm': { direction: 'place', level: 'low' }, 'left-arm': { direction: 'place', level: 'low' } },
  symbols: [
    { id: 'r1', column: 'right-arm', start: 2, duration: 1, direction: 'right', level: 'high' },
    { id: 'l0', column: 'left-arm', start: 3, duration: 1, direction: 'left', level: 'low' },
    { id: 'r0', column: 'right-arm', start: 0, duration: 1, direction: 'forward', level: 'middle' },
  ],
};

describe('canonicalScore', () => {
  it('sorts symbols by column order, then start', () => {
    const c = canonicalScore(a);
    expect(c.symbols.map((s) => s.id)).toEqual(['l0', 'r0', 'r1']);
  });

  it('serialises equal scores to the same JSON whatever the input order', () => {
    const shuffled: Score = {
      ...a,
      symbols: [a.symbols[2]!, a.symbols[0]!, a.symbols[1]!],
      startPosition: { 'left-arm': { level: 'low', direction: 'place' }, 'right-arm': { direction: 'place', level: 'low' } },
    };
    expect(JSON.stringify(canonicalScore(shuffled))).toBe(JSON.stringify(canonicalScore(a)));
  });

  it('does not modify its input', () => {
    const before = JSON.stringify(a);
    canonicalScore(a);
    expect(JSON.stringify(a)).toBe(before);
  });
});
