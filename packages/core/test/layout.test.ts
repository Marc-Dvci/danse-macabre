// Example tests for the staff layout (Requirement 3). Numbers below are staff units with the defaults: beatHeight 24,
// columnWidth 16. The centre line is at x = 64 and the staff is 128 wide.
import { describe, expect, it } from 'vitest';
import { canonicalScore, layoutStaff, type Point, type Score, type DirectionSymbol } from '../src/index';

function score(symbols: DirectionSymbol[], startPosition: Score['startPosition'] = {}, beatsPerBar = 2): Score {
  return canonicalScore({ version: 1, title: 'layout', tempo: 100, beatsPerBar, grid: 0.5, startPosition, symbols });
}

const one = (column: DirectionSymbol['column'], direction: DirectionSymbol['direction'], level: DirectionSymbol['level'], start = 0, duration = 2): DirectionSymbol => ({
  id: `${column}-0`,
  column,
  start,
  duration,
  direction,
  level,
});

const glyphOf = (s: Score, id: string) => layoutStaff(s).glyphs.find((g) => g.symbolId === id)!;

describe('layoutStaff: columns, lines and bars', () => {
  it('orders columns outward from the centre: support, leg, torso, arm on each side', () => {
    const layout = layoutStaff(score([]));
    expect(layout.columns.map((c) => c.id)).toEqual([
      'left-arm',
      'left-torso',
      'left-leg',
      'left-support',
      'right-support',
      'right-leg',
      'right-torso',
      'right-arm',
    ]);
    expect(layout.width).toBe(128);
  });

  it('draws three staff lines: left outer, centre, right outer', () => {
    const layout = layoutStaff(score([]));
    expect(layout.lines.map((l) => l.x)).toEqual([32, 64, 96]);
  });

  it('starts with a double bar line at beat 0 and draws a bar line every beatsPerBar beats', () => {
    const layout = layoutStaff(score([one('right-arm', 'place', 'high', 0, 4)], {}, 2));
    expect(layout.bars.map((b) => [b.y, b.double])).toEqual([
      [24, true],
      [72, false],
      [120, false],
    ]);
  });

  it('numbers the counts within the bar at every whole beat', () => {
    // A three-beat symbol in 2/4 fills two bars, so counts run over four beats.
    const layout = layoutStaff(score([one('right-arm', 'place', 'high', 0, 3)], {}, 2));
    expect(layout.counts.map((c) => c.label)).toEqual(['1', '2', '1', '2']);
    expect(layout.counts.map((c) => c.beat)).toEqual([0, 1, 2, 3]);
  });

  it('gives the staff at least one bar even with no symbols', () => {
    expect(layoutStaff(score([])).height).toBe((2 + 1) * 24);
  });
});

describe('layoutStaff: glyph geometry', () => {
  it('places a symbol at its beat, with height duration times beatHeight, in its column', () => {
    const g = glyphOf(score([one('right-arm', 'place', 'high', 1, 2)]), 'right-arm-0');
    expect(g).toMatchObject({ x: 112, y: 48, w: 16, h: 48, level: 'high', column: 'right-arm' });
  });

  it('puts the starting position in the zone below the double bar line', () => {
    const g = glyphOf(score([], { 'right-arm': { direction: 'place', level: 'low' } }), 'start:right-arm');
    expect(g).toMatchObject({ x: 112, y: 0, h: 24 });
  });

  it('draws a forward glyph with the notch at the top outer corner', () => {
    const g = glyphOf(score([one('right-arm', 'forward', 'middle')]), 'right-arm-0');
    expect(g.polygon).toEqual<Point[]>([
      { x: 112, y: 24 },
      { x: 128, y: 24 },
      { x: 128, y: 56 },
      { x: 120, y: 56 },
      { x: 120, y: 72 },
      { x: 112, y: 72 },
    ]);
  });

  it('draws a backward glyph with the notch at the bottom outer corner', () => {
    const g = glyphOf(score([one('right-arm', 'backward', 'middle')]), 'right-arm-0');
    expect(g.polygon).toEqual<Point[]>([
      { x: 112, y: 24 },
      { x: 120, y: 24 },
      { x: 120, y: 40 },
      { x: 128, y: 40 },
      { x: 128, y: 72 },
      { x: 112, y: 72 },
    ]);
  });

  it('draws a right-side "right" glyph as a triangle with its base on the inner edge', () => {
    const g = glyphOf(score([one('right-arm', 'right', 'low')]), 'right-arm-0');
    expect(g.polygon).toEqual<Point[]>([
      { x: 112, y: 24 },
      { x: 112, y: 72 },
      { x: 128, y: 48 },
    ]);
  });

  it('draws the left-side "left" glyph as its mirror: base on the inner edge (x = 16), apex at the outer middle (x = 0)', () => {
    const g = glyphOf(score([one('left-arm', 'left', 'low')]), 'left-arm-0');
    expect(g.polygon).toEqual<Point[]>([
      { x: 16, y: 24 },
      { x: 16, y: 72 },
      { x: 0, y: 48 },
    ]);
  });

  it('draws a right-forward diagonal with the right edge tall and the top edge slanting by a third of the height', () => {
    const g = glyphOf(score([one('right-arm', 'right-forward', 'high')]), 'right-arm-0');
    expect(g.polygon).toEqual<Point[]>([
      { x: 112, y: 24 },
      { x: 128, y: 24 },
      { x: 128, y: 72 },
      { x: 112, y: 56 },
    ]);
  });

  it('draws a left-backward diagonal with the left edge tall and the bottom edge slanting', () => {
    const g = glyphOf(score([one('right-arm', 'left-backward', 'high')]), 'right-arm-0');
    expect(g.polygon).toEqual<Point[]>([
      { x: 112, y: 24 },
      { x: 128, y: 40 },
      { x: 128, y: 72 },
      { x: 112, y: 72 },
    ]);
  });
});

describe('layoutStaff: errors and options', () => {
  it('throws RangeError for a non-positive beatHeight', () => {
    expect(() => layoutStaff(score([]), { beatHeight: 0 })).toThrow(RangeError);
  });

  it('scales with the options', () => {
    const layout = layoutStaff(score([one('right-arm', 'place', 'high', 0, 1)]), { beatHeight: 10, columnWidth: 8 });
    expect(layout.width).toBe(64);
    expect(glyphOf(score([one('right-arm', 'place', 'high', 0, 1)]), 'right-arm-0').h).toBe(24);
    const g = layout.glyphs.find((x) => x.symbolId === 'right-arm-0')!;
    expect(g).toMatchObject({ h: 10, w: 8 });
  });
});
