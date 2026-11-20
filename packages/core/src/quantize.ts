import type { BodyAxes, Cell, Direction, Level, Vec3 } from './types';
import { add, cross, dot, length, scale } from './vec';

/** Sector names by index k: sector k is centred on azimuth 45k degrees. */
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
 * An azimuth whose position within its sector is within this many sectors of a boundary counts as on the boundary.
 * Float noise in atan2 can move an exact boundary by about 1e-14 sectors, so 1e-9 is a safe margin.
 */
const BOUNDARY_TOLERANCE = 1e-9;

/**
 * Returns the sector index k (0 to 7) of an azimuth in degrees. The sector is the one whose centre is nearest. A
 * boundary (22.5, 67.5, 112.5, 157.5 and their negatives) goes to the sector farther from forward (Requirement 3.3),
 * so the rule is mirror-symmetric.
 * @param azimuthDeg Azimuth from forward toward right, in degrees, in any range.
 */
export function sectorIndex(azimuthDeg: number): number {
  const u = azimuthDeg / 45;
  const onBoundary = Math.abs(u - Math.floor(u) - 0.5) < BOUNDARY_TOLERANCE;
  const k = onBoundary ? (u > 0 ? Math.ceil(u) : Math.floor(u)) : Math.round(u);
  return ((k % 8) + 8) % 8;
}

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
  const direction = SECTOR_NAMES[sectorIndex(a)]!;
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

/** Elevation edges in degrees of the band (or place cell) that a cell occupies. */
function bandEdges(cell: Cell): number[] {
  if (cell.direction === 'place') return cell.level === 'high' ? [67.5] : [-67.5];
  if (cell.level === 'high') return [22.5, 67.5];
  if (cell.level === 'middle') return [-22.5, 22.5];
  return [-67.5, -22.5];
}

/**
 * Returns the angular distance in degrees from a vector to the nearest boundary of a gesture cell. The boundaries are
 * the elevation edges of the band and, for a sector cell, the two vertical planes at its azimuth edges. Requirement 4.8
 * compares this with the hysteresis width. Only the distance to the plane is measured, which is never larger than the
 * distance to the boundary edge, so the margin is conservative.
 * @param v A non-zero vector.
 * @param cell The cell to measure inside of.
 * @param axes Body axes of the dancer.
 */
export function cellMargin(v: Vec3, cell: Cell, axes: BodyAxes): number {
  const n = length(v);
  const e = Math.asin(Math.min(1, Math.max(-1, dot(v, axes.up) / n))) * DEG;
  let margin = Infinity;
  for (const edge of bandEdges(cell)) margin = Math.min(margin, Math.abs(e - edge));
  if (cell.direction === 'place') return margin;

  const k = SECTOR_NAMES.indexOf(cell.direction);
  for (const edgeAzimuth of [45 * k - 22.5, 45 * k + 22.5]) {
    const d = edgeAzimuth * RAD;
    const edgeDir = add(scale(axes.right, Math.sin(d)), scale(axes.forward, Math.cos(d)));
    const normal = cross(axes.up, edgeDir);
    const distance = Math.asin(Math.min(1, Math.abs(dot(v, normal)) / n)) * DEG;
    margin = Math.min(margin, distance);
  }
  return margin;
}
