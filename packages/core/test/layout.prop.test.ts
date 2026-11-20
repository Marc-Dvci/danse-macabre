// Property tests for the staff layout: Requirement 4.5 (one glyph per symbol, height, no overlap, mirror reflection).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { layoutStaff, mirrorScore } from '../src/index';
import { genScore } from './lesson-generators';
import { runOptions } from './generators';

const RUNS = 200;

const sizes = fc.record({
  beatHeight: fc.integer({ min: 8, max: 40 }),
  columnWidth: fc.integer({ min: 8, max: 24 }),
});

describe('Requirement 4.5: layout of generated scores', () => {
  it('every symbol has exactly one glyph, with height duration times beatHeight', () => {
    fc.assert(
      fc.property(genScore, sizes, (score, { beatHeight, columnWidth }) => {
        const layout = layoutStaff(score, { beatHeight, columnWidth });
        for (const s of score.symbols) {
          const glyphs = layout.glyphs.filter((g) => g.symbolId === s.id);
          expect(glyphs).toHaveLength(1);
          expect(glyphs[0]!.h).toBeCloseTo(s.duration * beatHeight, 9);
        }
        const symbolGlyphs = layout.glyphs.filter((g) => !g.symbolId.startsWith('start:'));
        expect(symbolGlyphs).toHaveLength(score.symbols.length);
      }),
      runOptions(RUNS),
    );
  });

  it('glyphs in one column do not overlap in staff units', () => {
    fc.assert(
      fc.property(genScore, sizes, (score, { beatHeight, columnWidth }) => {
        const layout = layoutStaff(score, { beatHeight, columnWidth });
        const byColumn = new Map<string, { y: number; h: number }[]>();
        for (const g of layout.glyphs) {
          const list = byColumn.get(g.column) ?? [];
          list.push(g);
          byColumn.set(g.column, list);
        }
        for (const list of byColumn.values()) {
          list.sort((a, b) => a.y - b.y);
          for (let i = 1; i < list.length; i++) {
            const prev = list[i - 1]!;
            const next = list[i]!;
            expect(next.y).toBeGreaterThanOrEqual(prev.y + prev.h - 1e-9);
          }
        }
      }),
      runOptions(RUNS),
    );
  });
});

describe('Requirement 4.5: mirror reflection', () => {
  it('each glyph of a mirrored score is the reflection, about the centre line, of the glyph of the original', () => {
    fc.assert(
      fc.property(genScore, sizes, (score, { beatHeight, columnWidth }) => {
        const opts = { beatHeight, columnWidth };
        const original = layoutStaff(score, opts);
        const mirrored = layoutStaff(mirrorScore(score), opts);
        const cx = 4 * columnWidth;
        const mirrorId = (id: string) => id.replace(/^(left|right)-/, (_m, side: string) => (side === 'left' ? 'right-' : 'left-'));

        for (const s of score.symbols) {
          const g = original.glyphs.find((x) => x.symbolId === s.id)!;
          const m = mirrored.glyphs.find((x) => x.symbolId === mirrorId(s.id))!;
          expect(m.polygon).toHaveLength(g.polygon.length);
          g.polygon.forEach((p, i) => {
            expect(m.polygon[i]!.x).toBeCloseTo(2 * cx - p.x, 9);
            expect(m.polygon[i]!.y).toBeCloseTo(p.y, 9);
          });
          expect(m.h).toBeCloseTo(g.h, 9);
        }
      }),
      runOptions(RUNS),
    );
  });
});
