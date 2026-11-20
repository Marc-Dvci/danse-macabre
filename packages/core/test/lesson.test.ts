// Example tests for the spoken lesson (Requirement 1). The score below is written by hand, so each expected line is
// easy to check against the words in the notation steering file.
import { describe as describeLesson, expect, it } from 'vitest';
import { canonicalScore, describe, parseLesson, type Score } from '../src/index';

const base: Score = {
  version: 1,
  title: 'example',
  tempo: 96,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: {},
  symbols: [
    { id: 'lsup', column: 'left-support', start: 0, duration: 2, direction: 'forward', level: 'low' },
    { id: 'ra', column: 'right-arm', start: 2, duration: 2, direction: 'forward', level: 'high' },
    { id: 'rl', column: 'right-leg', start: 4, duration: 1, direction: 'place', level: 'low' },
    { id: 'la', column: 'left-arm', start: 4.5, duration: 0.5, direction: 'place', level: 'high' },
  ],
};

describeLesson('describe: beat lines', () => {
  it('writes the start, the metre, then one line per beat with a symbol', () => {
    const lines = describe(base);
    expect(lines.map((l) => l.text)).toEqual([
      'Start standing.',
      '4 counts per bar, 96 counts per minute.',
      'Bar 1, count 1: step forward on the left foot, knees bent, over 2 counts.',
      'Count 3: right arm moves forward, high, over 2 counts.',
      'Bar 2, count 1: right leg moves straight down, over 1 count.',
      'Count 1 and: left arm moves straight up, over 0.5 counts.',
    ]);
  });

  it('gives beat, count, bar and symbol ids for each beat line', () => {
    const line = describe(base)[3]!;
    expect(line).toEqual({
      beat: 2,
      count: 3,
      bar: 1,
      text: 'Count 3: right arm moves forward, high, over 2 counts.',
      symbolIds: ['ra'],
    });
  });

  it('joins symbols that start on one beat in supports, legs, arms order with "; "', () => {
    const score: Score = canonicalScore({
      ...base,
      symbols: [
        { id: 'a', column: 'right-arm', start: 0, duration: 1, direction: 'place', level: 'high' },
        { id: 'b', column: 'left-arm', start: 0, duration: 1, direction: 'place', level: 'low' },
        { id: 'c', column: 'right-support', start: 0, duration: 1, direction: 'place', level: 'middle' },
      ],
    });
    const line = describe(score)[2]!;
    expect(line.text).toBe(
      'Bar 1, count 1: step in place on the right foot, standing normally, over 1 count; ' +
        'left arm moves down by your side, over 1 count; right arm moves straight up, over 1 count.',
    );
    expect(line.symbolIds).toEqual(['c', 'b', 'a']);
  });

  it('names the bar again only when the bar changes', () => {
    const texts = describe(base).map((l) => l.text);
    expect(texts.filter((t) => t.startsWith('Bar '))).toHaveLength(2);
  });
});

describeLesson('describe: starting position', () => {
  it('says arms down by your sides when both arms are place low', () => {
    const score: Score = canonicalScore({
      ...base,
      startPosition: { 'left-arm': { direction: 'place', level: 'low' }, 'right-arm': { direction: 'place', level: 'low' } },
    });
    expect(describe(score)[0]!.text).toBe('Start standing, arms down by your sides.');
    expect(describe(score)[0]!.symbolIds).toEqual(['start:left-arm', 'start:right-arm']);
  });

  it('describes a single start cell with its column', () => {
    const score: Score = canonicalScore({
      ...base,
      startPosition: { 'right-arm': { direction: 'forward', level: 'middle' } },
    });
    expect(describe(score)[0]!.text).toBe('Start standing, right arm moves forward, middle.');
  });
});

describeLesson('describe: errors', () => {
  it('throws RangeError for a symbol that starts off the half-beat grid', () => {
    const score: Score = canonicalScore({
      ...base,
      symbols: [{ id: 'x', column: 'left-arm', start: 0.25, duration: 0.5, direction: 'place', level: 'low' }],
    });
    expect(() => describe(score)).toThrow(RangeError);
  });

  it('throws RangeError when beatsPerBar is not a positive integer', () => {
    expect(() => describe({ ...base, beatsPerBar: 0 })).toThrow(RangeError);
  });
});

describeLesson('parseLesson: examples', () => {
  it('recovers the symbols of the example score in reading order', () => {
    expect(parseLesson(describe(base))).toEqual([
      { column: 'left-support', start: 0, duration: 2, direction: 'forward', level: 'low', turn: null },
      { column: 'right-arm', start: 2, duration: 2, direction: 'forward', level: 'high', turn: null },
      { column: 'right-leg', start: 4, duration: 1, direction: 'place', level: 'low', turn: null },
      { column: 'left-arm', start: 4.5, duration: 0.5, direction: 'place', level: 'high', turn: null },
    ]);
  });

  it('reads the bar number after a bar change and the half beat from "and"', () => {
    const lines = [
      { beat: null, count: null, bar: null, text: '3 counts per bar, 90 counts per minute.', symbolIds: [] },
      { beat: 3.5, count: 2, bar: 2, text: 'Bar 2, count 2 and: right arm moves backward, low, over 1 count.', symbolIds: [] },
    ];
    expect(parseLesson(lines)).toEqual([
      { column: 'right-arm', start: 4.5, duration: 1, direction: 'backward', level: 'low', turn: null },
    ]);
  });

  it('throws when the metre line is missing', () => {
    expect(() => parseLesson([{ beat: 0, count: 1, bar: 1, text: 'Bar 1, count 1: x.', symbolIds: [] }])).toThrow(/metre/);
  });

  it('throws when a beat line comes before any bar is named', () => {
    const lines = [
      { beat: null, count: null, bar: null, text: '4 counts per bar, 96 counts per minute.', symbolIds: [] },
      { beat: 0, count: 1, bar: 1, text: 'Count 1: left arm moves straight up, over 1 count.', symbolIds: [] },
    ];
    expect(() => parseLesson(lines)).toThrow(/before any bar/);
  });

  it('throws on a phrase the lesson does not use', () => {
    const lines = [
      { beat: null, count: null, bar: null, text: '4 counts per bar, 96 counts per minute.', symbolIds: [] },
      { beat: 0, count: 1, bar: 1, text: 'Bar 1, count 1: left arm waves wildly, over 1 count.', symbolIds: [] },
    ];
    expect(() => parseLesson(lines)).toThrow(/unknown phrase/);
  });
});
