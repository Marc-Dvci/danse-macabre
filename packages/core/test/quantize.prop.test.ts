import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cellCenter, GESTURE_CELLS, quantizeGesture, type BodyAxes, type Cell, type Vec3 } from '../src/index';
import { arbAxes, arbNonZeroVector, arbYaw, runOptions, yawAxes, yawVector } from './generators';
import { dot, length } from '../src/vec';

const RUNS = runOptions(500);

/** Elevation and azimuth of a vector, computed here from the definitions in Requirement 3.1. */
function angles(v: Vec3, axes: BodyAxes): { e: number; a: number } {
  const e = (Math.asin(dot(v, axes.up) / length(v)) * 180) / Math.PI;
  const a = (Math.atan2(dot(v, axes.right), dot(v, axes.forward)) * 180) / Math.PI;
  return { e, a };
}

/** Centre azimuth of sector j in degrees, in (-180, 180]. */
function centreDeg(j: number): number {
  const m = (((45 * j) % 360) + 360) % 360;
  return m > 180 ? m - 360 : m;
}

/**
 * True when azimuth a lies in the sector k of Requirement 3.3. A boundary (22.5 + 45m degrees from a centre) belongs to
 * the sector whose centre is farther from forward. Written here from the rule, not from quantizeGesture.
 */
function inSector(a: number, k: number): boolean {
  const d = ((((a - 45 * k) % 360) + 540) % 360) - 180;
  if (Math.abs(Math.abs(d) - 22.5) > 1e-7) return Math.abs(d) < 22.5;
  const other = d > 0 ? (k + 1) % 8 : (k + 7) % 8;
  return Math.abs(centreDeg(k)) > Math.abs(centreDeg(other));
}

/** Interval test of Requirement 3.2 and 3.3, written independently of quantizeGesture. */
function cellContains(cell: Cell, e: number, a: number): boolean {
  if (cell.direction === 'place') {
    return cell.level === 'high' ? e >= 67.5 : e <= -67.5;
  }
  const k = ['forward', 'right-forward', 'right', 'right-backward', 'backward', 'left-backward', 'left', 'left-forward']
    .indexOf(cell.direction);
  if (!inSector(a, k)) return false;
  if (cell.level === 'high') return e >= 22.5 && e < 67.5;
  if (cell.level === 'middle') return e > -22.5 && e < 22.5;
  return e > -67.5 && e <= -22.5;
}

describe('property 7.1: quantisation is total and disjoint', () => {
  it('exactly one of the 26 cells contains each non-zero vector, and quantizeGesture returns it', () => {
    fc.assert(
      fc.property(arbNonZeroVector, arbAxes, (v, axes) => {
        const { e, a } = angles(v, axes);
        const matches = GESTURE_CELLS.filter((c) => cellContains(c, e, a));
        expect(matches).toHaveLength(1);
        expect(quantizeGesture(v, axes)).toEqual(matches[0]);
      }),
      RUNS,
    );
  });

  it('cellCenter of every cell quantises back to that cell, for any axes', () => {
    fc.assert(
      fc.property(arbAxes, (axes) => {
        for (const cell of GESTURE_CELLS) {
          const c = cellCenter(cell, axes);
          expect(length(c)).toBeCloseTo(1, 9);
          expect(quantizeGesture(c, axes)).toEqual(cell);
        }
      }),
      RUNS,
    );
  });
});

describe('property 7.2: quantisation does not depend on facing', () => {
  it('rotating the vector and the axes by the same yaw gives the same cell', () => {
    fc.assert(
      fc.property(arbNonZeroVector, arbAxes, arbYaw, (v, axes, yaw) => {
        const rotated = quantizeGesture(yawVector(v, yaw), yawAxes(axes, yaw));
        expect(rotated).toEqual(quantizeGesture(v, axes));
      }),
      RUNS,
    );
  });
});
