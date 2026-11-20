import type { BodyAxes, Cell, Direction, Level, Vec3 } from './types';
import { add, dot, length, scale } from './vec';

/** Sector names by index k: sector k spans azimuths [45k - 22.5, 45k + 22.5) degrees. */
export const SECTOR_NAMES: readonly Direction[] = [
  'forward',
  'right-forward',
  'right',
  'right-backward',
  'backward',
  'left-backward',
  'left',
  'left-forward',
];

/** The 26 gesture cells: 8 sectors x 3 levels, plus `place high` and `place low`. */
export const GESTURE_CELLS: readonly Cell[] = [
  ...(['high', 'middle', 'low'] as const).flatMap((level) =>
    SECTOR_NAMES.map((direction) => ({ direction, level })),
  ),
  { direction: 'place', level: 'high' },
  { direction: 'place', level: 'low' },
];

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Elevation of each band's centre in degrees. */
const BAND_CENTRE_ELEVATION: Record<'high' | 'middle' | 'low', number> = { high: 45, middle: 0, low: -45 };

/**
 * Returns the gesture cell that contains a vector. Elevation picks the band (Requirement 3.2) and azimuth picks the
 * sector (Requirement 3.3). Place cells ignore azimuth.
 * @param v A non-zero vector, typically wrist minus shoulder or ankle minus hip.
 * @param axes Body axes of the dancer.
 * @throws RangeError when `v` is the zero vector.
 */
export function quantizeGesture(v: Vec3, axes: BodyAxes): Cell {
  const n = length(v);
  if (n < 1e-12) throw new RangeError('quantizeGesture: the zero vector has no direction');
  const sinE = Math.min(1, Math.max(-1, dot(v, axes.up) / n));
  const e = Math.asin(sinE) * DEG;
  if (e >= 67.5) return { direction: 'place', level: 'high' };
  if (e <= -67.5) return { direction: 'place', level: 'low' };

  const a = Math.atan2(dot(v, axes.right), dot(v, axes.forward)) * DEG;
  const k = ((Math.floor((a + 22.5) / 45) % 8) + 8) % 8;
  const direction = SECTOR_NAMES[k]!;
  if (e >= 22.5) return { direction, level: 'high' };
  if (e > -22.5) return { direction, level: 'middle' };
  return { direction, level: 'low' };
}

/**
 * Returns the unit vector at the centre of a gesture cell (Requirement 3.4).
 * @param cell A gesture cell. `{ place, middle }` is not a gesture cell.
 * @param axes Body axes of the dancer.
 * @throws RangeError for `{ place, middle }` or an unknown direction.
 */
export function cellCenter(cell: Cell, axes: BodyAxes): Vec3 {
  if (cell.direction === 'place') {
    if (cell.level === 'high') return axes.up;
    if (cell.level === 'low') return scale(axes.up, -1);
    throw new RangeError('cellCenter: "place middle" is not a gesture cell');
  }
  const k = SECTOR_NAMES.indexOf(cell.direction);
  if (k === -1) throw new RangeError(`cellCenter: unknown direction "${cell.direction}"`);
  const elevation = BAND_CENTRE_ELEVATION[cell.level as Level] * RAD;
  const azimuth = 45 * k * RAD;
  const horizontal = add(scale(axes.right, Math.sin(azimuth)), scale(axes.forward, Math.cos(azimuth)));
  return add(scale(horizontal, Math.cos(elevation)), scale(axes.up, Math.sin(elevation)));
}
