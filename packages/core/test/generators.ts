// Shared fast-check generators for the property tests. Not a test file (no ".test." in the name).
import fc from 'fast-check';
import {
  GESTURE_CELLS,
  WORLD_AXES,
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

/** Grid used by every generated score: half a beat. */
export const GRID = 0.5;

/**
 * Run options for a property. When the environment variable FC_SEED is set to an integer, the run uses that seed, so the
 * same generated inputs can be replayed or several seeds can be compared. Without it fast-check picks a random seed.
 * @param numRuns Number of generated inputs.
 */
export function runOptions(numRuns: number): fc.Parameters<unknown> {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.FC_SEED;
  if (raw === undefined || raw.trim() === '') return { numRuns };
  const seed = Number(raw);
  if (!Number.isInteger(seed)) throw new Error(`FC_SEED must be an integer, got "${raw}"`);
  return { numRuns, seed };
}

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

/**
 * Rotates a vector by `yawDeg` about +y. The rotation is proper (determinant +1), so handedness is kept. A positive yaw
 * turns a dancer facing +z toward +x.
 */
export function yawVector(v: Vec3, yawDeg: number): Vec3 {
  const c = Math.cos((yawDeg * Math.PI) / 180);
  const s = Math.sin((yawDeg * Math.PI) / 180);
  return { x: c * v.x + s * v.z, y: v.y, z: -s * v.x + c * v.z };
}

/** Rotates every axis of a body frame by the same yaw. */
export function yawAxes(axes: BodyAxes, yawDeg: number): BodyAxes {
  return {
    up: axes.up,
    right: yawVector(axes.right, yawDeg),
    forward: yawVector(axes.forward, yawDeg),
  };
}

/** Body axes turned by a random yaw from the world axes (right = −x, forward = +z). */
export const arbAxes: fc.Arbitrary<BodyAxes> = arbYaw.map((yaw) => yawAxes(WORLD_AXES, yaw));

export const arbTempo: fc.Arbitrary<number> = fc.integer({ min: 60, max: 180 });

/** Cells whose whole arc stays above the horizontal: high and middle sectors and `place high`. */
export const LIFTED_LEG_CELLS: Cell[] = GESTURE_CELLS.filter((c) =>
  c.direction === 'place' ? c.level === 'high' : c.level !== 'low',
);

const PLACE_LOW: Cell = { direction: 'place', level: 'low' };

type Plan = { startIdx: number; first: number; segments: { gap: number; units: number; idx: number }[] };

function arbPlan(allowed: readonly Cell[], maxSymbols: number): fc.Arbitrary<Plan> {
  const idx = fc.integer({ min: 0, max: allowed.length - 1 });
  return fc.record({
    startIdx: idx,
    // The first symbol starts at least one grid unit into the clip, so the limb has a rest before its first move.
    first: fc.integer({ min: 1, max: 3 }),
    segments: fc.array(
      fc.record({ gap: fc.integer({ min: 1, max: 3 }), units: fc.integer({ min: 2, max: 8 }), idx }),
      { minLength: 0, maxLength: maxSymbols },
    ),
  });
}

/** Turns a plan into a start cell and symbols. Each symbol's cell differs from the cell before it in the column. */
function materialize(column: ColumnId, allowed: readonly Cell[], plan: Plan): { start: Cell; symbols: Symbol[] } {
  let held = allowed[plan.startIdx]!;
  const start = held;
  const symbols: Symbol[] = [];
  let prevEndUnits = 0;
  plan.segments.forEach((seg, i) => {
    let k = seg.idx;
    if (allowed[k]!.direction === held.direction && allowed[k]!.level === held.level) {
      k = (k + 1) % allowed.length;
    }
    const cell = allowed[k]!;
    const startUnits = i === 0 ? plan.first : prevEndUnits + seg.gap;
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
  return { start, symbols };
}

/**
 * Generator for the Requirement 7.5 domain. Tempo is 60 to 180 bpm. Each symbol is 2 to 8 grid units long. The gap
 * before each symbol is 1 to 3 grid units, so each column has at least one grid unit of stillness between symbols. Each
 * symbol moves into a cell that differs from the limb's previous cell. Leg symbols appear in at most one leg column,
 * and that leg's cells are only ones whose whole arc is above the floor (LIFTED_LEG_CELLS). The other leg stays at
 * `place low` with no symbols. Arms use any gesture cell. `grid` is 0.5 beats and `beatsPerBar` is 4.
 */
export const genGestureScore: fc.Arbitrary<Score> = fc
  .record({
    tempo: arbTempo,
    leftArm: arbPlan(GESTURE_CELLS, 4),
    rightArm: arbPlan(GESTURE_CELLS, 4),
    leg: arbPlan(LIFTED_LEG_CELLS, 3),
    legSide: fc.constantFrom<'left-leg' | 'right-leg' | 'none'>('left-leg', 'right-leg', 'none'),
  })
  .map((p) => {
    const startPosition: Partial<Record<ColumnId, Cell>> = {};
    const symbols: Symbol[] = [];
    const put = (column: ColumnId, allowed: readonly Cell[], plan: Plan, active: boolean) => {
      if (!active) {
        startPosition[column] = PLACE_LOW;
        return;
      }
      const m = materialize(column, allowed, plan);
      startPosition[column] = m.start;
      symbols.push(...m.symbols);
    };
    put('left-arm', GESTURE_CELLS, p.leftArm, true);
    put('right-arm', GESTURE_CELLS, p.rightArm, true);
    put('left-leg', LIFTED_LEG_CELLS, p.leg, p.legSide === 'left-leg');
    put('right-leg', LIFTED_LEG_CELLS, p.leg, p.legSide === 'right-leg');
    return canonicalScore({
      version: 1,
      title: 'generated',
      tempo: p.tempo,
      beatsPerBar: 4,
      grid: GRID,
      startPosition,
      symbols,
    });
  });

/** Random frames with 15 joints each, at 1/30 s spacing. Not gesture-shaped. */
export const genRandomFrames: fc.Arbitrary<Frame[]> = fc
  .array(fc.array(arbVec3, { minLength: JOINTS.length, maxLength: JOINTS.length }), {
    minLength: 1,
    maxLength: 12,
  })
  .map((rows) =>
    rows.map((row, i) => ({
      t: i / 30,
      joints: Object.fromEntries(JOINTS.map((name, j) => [name, row[j]!])) as Record<JointName, Vec3>,
    })),
  );

/** Symbol tuple used to compare notation output with the score it came from. */
export function symbolTuples(score: Score): string[] {
  return score.symbols.map((s) => `${s.column}|${s.start}|${s.duration}|${s.direction}|${s.level}`);
}
