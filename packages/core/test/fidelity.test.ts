import { describe, expect, it } from 'vitest';
import { performGestures, replayFidelity, type Score } from '../src/index';

/** One arm symbol and no leg symbols. Both feet stay on the floor, so no leg sample is counted. */
const armOnly: Score = {
  version: 1,
  title: 'arm only',
  tempo: 100,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: {},
  symbols: [{ id: 'a', column: 'right-arm', start: 0, duration: 2, direction: 'forward', level: 'middle' }],
};

describe('replayFidelity examples', () => {
  // Property F4, Requirement 1.3: legs with both feet on the floor are not compared.
  it('gives NaN for legs when no foot is off the floor (Req 1.3)', () => {
    const r = replayFidelity(performGestures(armOnly), armOnly);
    expect(r.perLimb['left-leg']).toBeNaN();
    expect(r.perLimb['right-leg']).toBeNaN();
    expect(r.perLimb['right-arm']).toBeLessThan(1);
  });

  it('uses the recording rate when fps is not given', () => {
    const rec = performGestures(armOnly, { fps: 10 });
    const r = replayFidelity(rec, armOnly);
    expect(r.frames).toBeGreaterThan(0);
    expect(r.frames).toBeLessThanOrEqual(rec.length);
  });

  it('returns NaN statistics for an empty recording', () => {
    const r = replayFidelity([], armOnly);
    expect(r.frames).toBe(0);
    expect(r.meanDegrees).toBeNaN();
  });
});
