// Tests for the SVG renderer (Requirement 3.6).
import { describe, expect, it } from 'vitest';
import { canonicalScore, layoutStaff, renderStaffSvg, type Score } from '../src/index';

const score: Score = canonicalScore({
  version: 1,
  title: 'A <test> & "more"',
  tempo: 100,
  beatsPerBar: 2,
  grid: 0.5,
  startPosition: { 'right-arm': { direction: 'place', level: 'low' } },
  symbols: [
    { id: 'right-arm-0', column: 'right-arm', start: 0, duration: 1, direction: 'forward', level: 'high' },
    { id: 'left-arm-0', column: 'left-arm', start: 0, duration: 1, direction: 'place', level: 'middle' },
    { id: 'left-leg-0', column: 'left-leg', start: 1, duration: 1, direction: 'place', level: 'low' },
  ],
});

describe('renderStaffSvg', () => {
  it('returns a standalone svg element with the layout size as its viewBox', () => {
    const svg = renderStaffSvg(score);
    const layout = layoutStaff(score);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${layout.width} ${layout.height}"`);
  });

  it('gives every glyph a data-symbol-id, one per glyph of the layout', () => {
    const svg = renderStaffSvg(score);
    const ids = [...svg.matchAll(/data-symbol-id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(layoutStaff(score).glyphs.map((g) => g.symbolId));
    expect(ids).toContain('start:right-arm');
  });

  it('hatches high level, centre-dots middle level and fills low level', () => {
    const svg = renderStaffSvg(score);
    expect(svg).toMatch(/fill="url\(#hatch\)"/);
    expect(svg).toMatch(/<circle [^>]*r="1.8"/);
    expect(svg).toMatch(/fill="#000" stroke="#000"/);
  });

  it('defines the hatch as lines rising to the right at 45 degrees', () => {
    expect(renderStaffSvg(score)).toContain('<path d="M0 4 L4 0"');
  });

  it('escapes the title', () => {
    expect(renderStaffSvg(score)).toContain('<title>A &lt;test&gt; &amp; &quot;more&quot;</title>');
  });

  it('flips y so that the first beat is at the bottom of the page', () => {
    // The start glyph covers staff y 0 to 24, so in SVG (y down) its points sit at y = height - 0 and height - 24.
    const svg = renderStaffSvg(score);
    const height = layoutStaff(score).height;
    const group = svg.slice(svg.indexOf('data-symbol-id="start:right-arm"'));
    const points = /points="([^"]+)"/.exec(group)![1]!;
    const ys = points.split(' ').map((p) => Number(p.split(',')[1]));
    expect(Math.max(...ys)).toBe(height);
    expect(Math.min(...ys)).toBe(height - 24);
  });
});

describe('renderStaffSvg: turn signs', () => {
  it('draws each turn with its id and the amount label (1/4, 1/2, 3/4, 1)', () => {
    const turns = canonicalScore({
      version: 1,
      title: 'turns',
      tempo: 100,
      beatsPerBar: 4,
      grid: 0.5,
      startPosition: {},
      symbols: [
        { id: 't1', kind: 'turn', column: 'right-support', start: 0, duration: 1, rotation: 'cw', amount: 0.25 },
        { id: 't2', kind: 'turn', column: 'left-support', start: 1, duration: 1, rotation: 'ccw', amount: 0.5 },
        { id: 't3', kind: 'turn', column: 'right-support', start: 2, duration: 1, rotation: 'cw', amount: 0.75 },
        { id: 't4', kind: 'turn', column: 'left-support', start: 3, duration: 1, rotation: 'ccw', amount: 1 },
      ],
    });
    const svg = renderStaffSvg(turns);
    for (const [id, label] of [
      ['t1', '1/4'],
      ['t2', '1/2'],
      ['t3', '3/4'],
      ['t4', '1'],
    ] as const) {
      expect(svg).toContain(`<g data-symbol-id="${id}">`);
      expect(svg).toContain(`>${label}</text>`);
    }
  });
});
