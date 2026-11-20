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

describe('azimuth on a sector boundary goes to the sector farther from forward (Requirement 3.3)', () => {
  // Level vectors: azimuth a means v = right * sin(a) + forward * cos(a). On world axes that is (-sin a, 0, cos a).
  const at = (azimuth: number) => {
    const r = (azimuth * Math.PI) / 180;
    return v(-Math.sin(r), 0, Math.cos(r));
  };

  it('assigns each positive boundary to the sector on its far side', () => {
    expect(quantizeGesture(at(22.5), WORLD_AXES).direction).toBe('right-forward');
    expect(quantizeGesture(at(67.5), WORLD_AXES).direction).toBe('right');
    expect(quantizeGesture(at(112.5), WORLD_AXES).direction).toBe('right-backward');
    expect(quantizeGesture(at(157.5), WORLD_AXES).direction).toBe('backward');
  });

  it('assigns each negative boundary to the sector on its far side, so the rule is mirror-symmetric', () => {
    expect(quantizeGesture(at(-22.5), WORLD_AXES).direction).toBe('left-forward');
    expect(quantizeGesture(at(-67.5), WORLD_AXES).direction).toBe('left');
    expect(quantizeGesture(at(-112.5), WORLD_AXES).direction).toBe('left-backward');
    expect(quantizeGesture(at(-157.5), WORLD_AXES).direction).toBe('backward');
  });

  it('keeps the sector centres and the points just inside each sector unchanged', () => {
    expect(quantizeGesture(at(0), WORLD_AXES).direction).toBe('forward');
    expect(quantizeGesture(at(22.4), WORLD_AXES).direction).toBe('forward');
    expect(quantizeGesture(at(22.6), WORLD_AXES).direction).toBe('right-forward');
    expect(quantizeGesture(at(-22.4), WORLD_AXES).direction).toBe('forward');
    expect(quantizeGesture(at(-22.6), WORLD_AXES).direction).toBe('left-forward');
  });
});
