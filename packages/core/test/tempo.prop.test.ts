import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { performGestures, retime, type Frame } from '../src/index';
import { genGestureScore } from './generators';

const RUNS = { numRuns: 200 };

describe('property 7.6: retime by 2 halves every pose time', () => {
  it('frame k of the doubled tempo equals frame 2k of the original', () => {
    fc.assert(
      fc.property(genGestureScore, (s) => {
        const original = performGestures(s);
        const fast = performGestures(retime(s, 2));
        expect(fast.length).toBeGreaterThan(0);
        for (let k = 0; k < fast.length; k++) {
          const a: Frame = fast[k]!;
          const b: Frame = original[2 * k]!;
          expect(b).toBeDefined();
          expect(a.t * 2).toBeCloseTo(b.t, 9);
          for (const name of Object.keys(a.joints) as (keyof Frame['joints'])[]) {
            const pa = a.joints[name];
            const pb = b.joints[name];
            expect(pa.x).toBeCloseTo(pb.x, 9);
            expect(pa.y).toBeCloseTo(pb.y, 9);
            expect(pa.z).toBeCloseTo(pb.z, 9);
          }
        }
      }),
      RUNS,
    );
  });
});
