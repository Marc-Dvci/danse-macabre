import { describe as lessonOf, validateScore } from '@danse/core';
import { describe, expect, it } from 'vitest';
import { composeScore, type Move } from '../src/compose';

/**
 * The Macarena's first eight counts, written by hand from the notated lesson in examples/macarena-lesson.txt
 * (CMU subject 143, trial 35). Tempo 100, four counts per bar, grid 1. The right arm moves forward on count 1 here,
 * as Requirement 3.2 states. The notated lesson has that move on "count 2 and".
 */
const MACARENA_EIGHT_COUNTS: Move[] = [
  { count: 1, column: 'right-arm', direction: 'forward', level: 'middle', counts: 1 },
  { count: 2, column: 'left-arm', direction: 'forward', level: 'middle', counts: 1 },
  { count: 3, column: 'left-arm', direction: 'backward', level: 'low', counts: 1 },
  { count: 4, column: 'left-arm', direction: 'forward', level: 'middle', counts: 4 },
  { count: 4, column: 'right-arm', direction: 'forward', level: 'middle', counts: 4 },
];

const BASE = { title: 'Macarena, first eight counts', tempo: 100, beatsPerBar: 4, grid: 1 };

describe('composeScore', () => {
  it('maps move count c to start c - 1 beats and keeps the duration in counts', () => {
    const result = composeScore({ ...BASE, moves: MACARENA_EIGHT_COUNTS });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.score.symbols.map((s) => [s.id, s]));
    expect(byId.size).toBe(MACARENA_EIGHT_COUNTS.length);
    expect(byId.get('m1-right-arm')).toMatchObject({ start: 0, duration: 1 });
    expect(byId.get('m2-left-arm')).toMatchObject({ start: 1, duration: 1 });
    expect(byId.get('m3-left-arm')).toMatchObject({ start: 2, duration: 1 });
    expect(byId.get('m4-left-arm')).toMatchObject({ start: 3, duration: 4 });
    expect(byId.get('m5-right-arm')).toMatchObject({ start: 3, duration: 4 });
  });

  it('returns a score that passes validateScore and carries the metre and tempo', () => {
    const result = composeScore({ ...BASE, moves: MACARENA_EIGHT_COUNTS });
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(validateScore(result.score)).toEqual({ ok: true });
    expect(result.score.tempo).toBe(100);
    expect(result.score.beatsPerBar).toBe(4);
    expect(result.score.version).toBe(1);
  });

  it('gives every symbol a unique id that names its move position and column', () => {
    const result = composeScore({ ...BASE, moves: MACARENA_EIGHT_COUNTS });
    if (!result.ok) throw new Error(result.errors.join('; '));
    const ids = result.score.symbols.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('m1-right-arm');
  });

  it('writes a turn move in a support column as a turn symbol', () => {
    const result = composeScore({
      ...BASE,
      moves: [{ count: 3, column: 'right-support', turn: 'cw', amount: 0.5, counts: 1 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.symbols[0]).toMatchObject({ kind: 'turn', rotation: 'cw', amount: 0.5, start: 2 });
  });

  it('rejects a turn move in a gesture column and reports the rule', () => {
    const result = composeScore({
      ...BASE,
      moves: [{ count: 1, column: 'left-arm', turn: 'ccw', amount: 1, counts: 1 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toContain('a turn sign must be in a support column');
  });

  it('rejects overlapping moves in one column and lists the problem', () => {
    const result = composeScore({
      ...BASE,
      moves: [
        { count: 1, column: 'left-arm', direction: 'forward', level: 'high', counts: 2 },
        { count: 2, column: 'left-arm', direction: 'left', level: 'high', counts: 1 },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('overlap in time'))).toBe(true);
  });

  it('rejects "place middle" in a gesture column', () => {
    const result = composeScore({
      ...BASE,
      moves: [{ count: 1, column: 'right-arm', direction: 'place', level: 'middle', counts: 1 }],
    });
    expect(result.ok).toBe(false);
  });
});

describe('Macarena lesson (Requirement 3.2)', () => {
  it('describe mentions "right arm moves forward, middle" on count 1', () => {
    const result = composeScore({ ...BASE, moves: MACARENA_EIGHT_COUNTS });
    if (!result.ok) throw new Error(result.errors.join('; '));
    const lines = lessonOf(result.score);
    const countOne = lines.find((l) => l.count === 1);
    expect(countOne).toBeDefined();
    expect(countOne?.text).toContain('right arm moves forward, middle');
  });
});
