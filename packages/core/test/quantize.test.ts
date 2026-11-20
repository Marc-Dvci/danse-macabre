import { describe, expect, it } from 'vitest';
import { WORLD_AXES, quantizeGesture } from '../src/index';

const v = (x: number, y: number, z: number) => ({ x, y, z });

describe('quantizeGesture on world axes (right = -x, forward = +z)', () => {
  it('maps the four horizontal directions and the vertical cells', () => {
    expect(quantizeGesture(v(0, 0, 1), WORLD_AXES)).toEqual({ direction: 'forward', level: 'middle' });
    expect(quantizeGesture(v(-1, 0, 0), WORLD_AXES)).toEqual({ direction: 'right', level: 'middle' });
    expect(quantizeGesture(v(0, 0, -1), WORLD_AXES)).toEqual({ direction: 'backward', level: 'middle' });
    expect(quantizeGesture(v(1, 0, 0), WORLD_AXES)).toEqual({ direction: 'left', level: 'middle' });
    expect(quantizeGesture(v(0, 1, 0), WORLD_AXES)).toEqual({ direction: 'place', level: 'high' });
    expect(quantizeGesture(v(0, -1, 0), WORLD_AXES)).toEqual({ direction: 'place', level: 'low' });
  });

  it('maps diagonals to the corner sectors and levels by elevation', () => {
    expect(quantizeGesture(v(-1, 0, 1), WORLD_AXES)).toEqual({ direction: 'right-forward', level: 'middle' });
    expect(quantizeGesture(v(1, 0, -1), WORLD_AXES)).toEqual({ direction: 'left-backward', level: 'middle' });
    // Elevation 30 degrees is in the high band; elevation -30 is in the low band.
    expect(quantizeGesture(v(0, 0.5, Math.sqrt(0.75)), WORLD_AXES)).toEqual({ direction: 'forward', level: 'high' });
    expect(quantizeGesture(v(0, -0.5, Math.sqrt(0.75)), WORLD_AXES)).toEqual({ direction: 'forward', level: 'low' });
  });

  it('a dancer facing +z has the right side at -x', () => {
    // Requirement 2.1: a vector toward -x is the dancer's right.
    expect(quantizeGesture(v(-1, 0, 0), WORLD_AXES).direction).toBe('right');
  });

  it('throws on the zero vector', () => {
    expect(() => quantizeGesture(v(0, 0, 0), WORLD_AXES)).toThrow(RangeError);
  });
});
