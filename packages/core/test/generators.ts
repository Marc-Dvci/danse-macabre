// Shared fast-check generators for the property tests. Not a test file (no ".test." in the name).
import fc from 'fast-check';
import {
  GESTURE_CELLS,
  GESTURE_COLUMNS,
  canonicalScore,
  type BodyAxes,
  type Cell,
  type ColumnId,
  type Frame,
  type JointName,
  type Score,
  type Symbol,
  type Vec3,
} from '../src/index';

/** Grid used by every generated score. Half a beat keeps the timing error of 30 fps frames within half a grid. */
export const GRID = 0.5;

const JOINTS: JointName[] = [
  'pelvis',
  'left-hip',
  'right-hip',
  'left-knee',
  'right-knee',
  'left-ankle',
  'right-ankle',
  'left-shoulder',
  'right-shoulder',
  'left-elbow',
  'right-elbow',
  'left-wrist',
  'right-wrist',
  'neck',
  'head',
];

export const arbVec3: fc.Arbitrary<Vec3> = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true }),
  z: fc.double({ min: -1, max: 1, noNaN: true }),
});

/** A vector of length above 1e-6. */
export const arbNonZeroVector: fc.Arbitrary<Vec3> = arbVec3.filter(
  (v) => Math.hypot(v.x, v.y, v.z) > 1e-6,
);

/** Yaw in degrees about the world up axis. */
export const arbYaw: fc.Arbitrary<number> = fc.double({ min: 0, max: 360, noNaN: true });

/** Rotates a vector by `yawDeg` about +y. A positive yaw turns the dancer's front from +z toward +x. */
export function yawVector(v: Vec3, yawDeg: number): Vec3 {
  const c = Math.cos((yawDeg * Math.PI) / 180);
  const s = Math.sin((yawDeg * Math.PI) / 180);
  return { x: c * v.x + s * v.z, y: v.y, z: -s * v.x + c * v.z };
}

/** Rotates every axis of a frame by the same yaw. */
export function yawAxes(axes: BodyAxes, yawDeg: number): BodyAxes {
  return {
    up: axes.up,
    right: yawVector(axes.right, yawDeg),
    forward: yawVector(axes.forward, yawDeg),
  };
}

/** Body axes turned by a random yaw from the world axes. */
export const arbAxes: fc.Arbitrary<BodyAxes> = arbYaw.map((yaw) =>
  yawAxes({ up: { x: 0, y: 1, z: 0 }, right: { x: 1, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 1 } }, yaw),
);

export const arbTempo = fc.constantFrom(60, 90, 120, 150, 180);

/**
 * Gesture score with generated symbols (property 7.5 domain). Each gesture column has 0 to 4 symbols. Symbols are at
 * least two grid units long (2, 3, 4, 6 or 8 units). The gap before each symbol is 1, 2 or 3 units, so the stillness
 * is at least one grid unit. Each symbol's cell differs from the cell before it in its column.
 */
export function genGestureScoreWith(options: {
  tempos: fc.Arbitrary<number>;
  durations: number[];
  maxSymbols: number;
}): fc.Arbitrary<Score> {
  const arbCell = fc.constantFrom(...GESTURE_CELLS);
  const arbSegment = fc.record({
    gap: fc.constantFrom(1, 2, 3),
    units: fc.constantFrom(...options.durations),
    cell: arbCell,
  });
  const arbColumn = fc.record({
    startCell: arbCell,
    first: fc.constantFrom(0, 1, 2),
    segments: fc.array(arbSegment, { minLength: 0, maxLength: options.maxSymbols }),
  });
  return fc
    .record({
      tempo: options.tempos,
      columns: fc.tuple(...GESTURE_COLUMNS.map(() => arbColumn)),
    })
    .map(({ tempo, columns }) => {
      const startPosition: Partial<Record<ColumnId, Cell>> = {};
      const symbols: Symbol[] = [];
      GESTURE_COLUMNS.forEach((column, ci) => {
        const col = columns[ci]!;
        startPosition[column] = col.startCell;
        let held = col.startCell;
        let prevEndUnits = 0;
        col.segments.forEach((seg, i) => {
          let cell = seg.cell;
          if (cell.direction === held.direction && cell.level === held.level) {
            const idx = GESTURE_CELLS.findIndex((c) => c.direction === cell.direction && c.level === cell.level);
            cell = GESTURE_CELLS[(idx + 1) % GESTURE_CELLS.length]!;
          }
          const startUnits = i === 0 ? col.first : prevEndUnits + seg.gap;
          symbols.push({
            id: `${column}-${i}`,
            column,
            start: startUnits * GRID,
            duration: seg.units * GRID,
            direction: cell.direction,
            level: cell.level,
          });
          prevEndUnits = startUnits + seg.units;
          held = cell;
        });
      });
      return canonicalScore({
        version: 1,
        title: 'generated',
        tempo,
        beatsPerBar: 4,
        grid: GRID,
        startPosition,
        symbols,
      });
    });
}

export const genGestureScore: fc.Arbitrary<Score> = genGestureScoreWith({
  tempos: arbTempo,
  durations: [2, 3, 4, 6, 8],
  maxSymbols: 4,
});

/**
 * Arms-only score where every symbol is two grid units (one beat). Used only by the diagnostic property P7.5d, at tempos
 * where the smallest move between adjacent cells (31.4 degrees, one beat) peaks above the 60 deg/s rule of Requirement 4.4.
 */
export const genArmSprintScore: fc.Arbitrary<Score> = genGestureScoreWith({
  tempos: fc.constantFrom(120, 150, 180),
  durations: [2],
  maxSymbols: 5,
}).map((s) => ({
  ...s,
  symbols: s.symbols.filter((sym) => sym.column === 'left-arm' || sym.column === 'right-arm'),
  startPosition: {
    'left-arm': s.startPosition['left-arm'],
    'right-arm': s.startPosition['right-arm'],
  },
}));

/** Random frames with 15 joints each, at 1/30 s spacing. Not gesture-shaped. */
export const genRandomFrames: fc.Arbitrary<Frame[]> = fc.array(
  fc.array(arbVec3, { minLength: JOINTS.length, maxLength: JOINTS.length }),
  { minLength: 1, maxLength: 12 },
).map((rows) =>
  rows.map((row, i) => ({
    t: i / 30,
    joints: Object.fromEntries(JOINTS.map((name, j) => [name, row[j]!])) as Record<JointName, Vec3>,
  })),
);

/** Symbol tuple used to compare notation output with the score it came from. */
export function symbolTuples(score: Score): string[] {
  return score.symbols.map(
    (s) => `${s.column}|${s.start}|${s.duration}|${s.direction}|${s.level}`,
  );
}
