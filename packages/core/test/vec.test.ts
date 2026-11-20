import { describe, expect, it } from 'vitest';
import { add, angleDeg, cross, dot, length, normalize, scale, sub } from '../src/vec';

const v = (x: number, y: number, z: number) => ({ x, y, z });

describe('vec helpers', () => {
  it('add, sub and scale work component by component', () => {
    expect(add(v(1, 2, 3), v(4, 5, 6))).toEqual(v(5, 7, 9));
    expect(sub(v(1, 2, 3), v(4, 5, 6))).toEqual(v(-3, -3, -3));
    expect(scale(v(1, -2, 3), 2)).toEqual(v(2, -4, 6));
  });

  it('dot and length', () => {
    expect(dot(v(1, 2, 3), v(4, -5, 6))).toBe(4 - 10 + 18);
    expect(length(v(3, 4, 0))).toBe(5);
  });

  it('cross follows the right-hand rule: x cross y is z, and y cross x is -z', () => {
    const near = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
      expect(a.x).toBeCloseTo(b.x, 12);
      expect(a.y).toBeCloseTo(b.y, 12);
      expect(a.z).toBeCloseTo(b.z, 12);
    };
    near(cross(v(1, 0, 0), v(0, 1, 0)), v(0, 0, 1));
    near(cross(v(0, 1, 0), v(1, 0, 0)), v(0, 0, -1));
    // Requirement 2.1: with up = +y and right = -x, the forward direction is +z.
    near(cross(v(0, 1, 0), v(-1, 0, 0)), v(0, 0, 1));
  });

  it('normalize returns a unit vector and throws on the zero vector', () => {
    const n = normalize(v(0, 3, 4));
    expect(n.y).toBeCloseTo(0.6, 12);
    expect(n.z).toBeCloseTo(0.8, 12);
    expect(() => normalize(v(0, 0, 0))).toThrow(RangeError);
  });

  it('angleDeg returns the angle in degrees, and 0 when either vector is zero', () => {
    expect(angleDeg(v(1, 0, 0), v(0, 1, 0))).toBeCloseTo(90, 9);
    expect(angleDeg(v(1, 0, 0), v(-1, 0, 0))).toBeCloseTo(180, 9);
    expect(angleDeg(v(1, 0, 0), v(1, 0, 0))).toBe(0);
    expect(angleDeg(v(0, 0, 0), v(1, 0, 0))).toBe(0);
  });
});
