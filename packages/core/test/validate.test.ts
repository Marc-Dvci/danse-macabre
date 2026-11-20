import { describe, expect, it } from 'vitest';
import { validateScore, type Direction, type Score, type Symbol } from '../src/index';

const base: Score = {
  version: 1,
  title: 'test',
  tempo: 60,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: { 'right-arm': { direction: 'place', level: 'low' } },
  symbols: [
    { id: 'a', column: 'right-arm', start: 0, duration: 1, direction: 'right', level: 'middle' },
    { id: 'b', column: 'right-arm', start: 1, duration: 1, direction: 'place', level: 'high' },
  ],
};

function withSymbols(symbols: Symbol[]): Score {
  return { ...base, symbols };
}

describe('validateScore', () => {
  it('accepts a valid score', () => {
    expect(validateScore(base)).toEqual({ ok: true });
  });

  it('reports a start that is not a multiple of the grid', () => {
    const r = validateScore(withSymbols([{ ...base.symbols[0]!, start: 0.25 }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(1);
  });

  it('reports a duration below one grid unit', () => {
    const r = validateScore(withSymbols([{ ...base.symbols[0]!, duration: 0.25 }]));
    expect(r.ok).toBe(false);
  });

  it('reports overlapping symbols in one column but not touching ones', () => {
    const overlap = validateScore(
      withSymbols([base.symbols[0]!, { ...base.symbols[1]!, start: 0.5 }]),
    );
    expect(overlap.ok).toBe(false);
    const touching = validateScore(withSymbols([base.symbols[0]!, base.symbols[1]!]));
    expect(touching.ok).toBe(true);
  });

  it('reports place middle in a gesture column', () => {
    const r = validateScore(
      withSymbols([{ ...base.symbols[0]!, direction: 'place', level: 'middle' }]),
    );
    expect(r.ok).toBe(false);
  });

  it('reports unknown column, direction and level', () => {
    const r = validateScore(
      withSymbols([
        { ...base.symbols[0]!, column: 'torso' as Symbol['column'] },
        { ...base.symbols[1]!, direction: 'up' as Direction },
        { ...base.symbols[1]!, id: 'c', level: 'top' as Symbol['level'] },
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('reports a non-positive tempo and duplicate ids', () => {
    expect(validateScore({ ...base, tempo: 0 }).ok).toBe(false);
    const dup = validateScore(withSymbols([base.symbols[0]!, { ...base.symbols[1]!, id: 'a' }]));
    expect(dup.ok).toBe(false);
  });
});
