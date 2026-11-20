# Design: laban-core

Implements `requirements.md` in `packages/core/src`. Public API is exported from `src/index.ts` only.

## Modules

| File | Contents | Requirements |
|---|---|---|
| `types.ts` | `Vec3`, `Frame`, `JointName`, `ColumnId`, `Direction`, `Level`, `Cell`, `Symbol`, `Score`, `BodyAxes`, `ValidationResult` | 1.1 |
| `vec.ts` | Vector helpers: `add`, `sub`, `scale`, `dot`, `cross`, `length`, `normalize`, `angleDeg` | 2, 3 |
| `score.ts` | `GESTURE_COLUMNS`, `COLUMN_ORDER`, `DIRECTIONS`, `LEVELS`, `validateScore`, `canonicalScore` | 1 |
| `body-frame.ts` | `bodyFrame(frame, previous?)` | 2 |
| `quantize.ts` | `SECTOR_NAMES`, `GESTURE_CELLS` (26 cells), `quantizeGesture(v, axes)`, `cellCenter(cell, axes)` | 3 |
| `rig.ts` | `Rig`, `standardRig()`, `restPose(rig)`, `limbBase(column)` | 5.1, 5.3 |
| `interpolate.ts` | `slerp(u0, u1, k)` with the antipodal case, `smoothstep(u)` | 5.2 |
| `perform.ts` | `performGestures(score, options?)` | 5 |
| `notate.ts` | `notateGestures(frames, options)` and its helpers (move detection, lift test, grid rounding) | 4 |
| `mirror.ts` | `mirrorScore`, `mirrorFrames`, `retime` | 6 |
| `index.ts` | Public exports | 1.1 |

Tests live in `packages/core/test/`. Shared generators are in `test/generators.ts` (no `.test.` in the name, so
vitest does not run it as a test file).

## Function signatures

```ts
type Vec3 = { x: number; y: number; z: number };
type BodyAxes = { up: Vec3; right: Vec3; forward: Vec3 };
type Cell = { direction: Direction; level: Level };

bodyFrame(frame: Frame, previous?: BodyAxes): BodyAxes;
quantizeGesture(v: Vec3, axes: BodyAxes): Cell;          // throws RangeError on the zero vector
cellCenter(cell: Cell, axes: BodyAxes): Vec3;            // throws on {place, middle}
validateScore(score: Score): { ok: true } | { ok: false; errors: string[] };
canonicalScore(score: Score): Score;
standardRig(): Rig;
performGestures(score: Score, options?: { fps?: number; rig?: Rig }): Frame[];
notateGestures(frames: Frame[], options: NotateOptions): Score;
  // NotateOptions = { tempo; beatsPerBar; grid; title; minHold?; stillSpeed?; liftHeight? }
mirrorScore(score: Score): Score;
mirrorFrames(frames: Frame[]): Frame[];
retime(score: Score, factor: number): Score;
```

## Fixed conventions

- Axes for quantisation: `up = (0,1,0)`, `right = +x`, `forward = +z` for the standard rig. Azimuth
  `a = atan2(v·right, v·forward)`. Sector `k = floor((a + 22.5) / 45) mod 8`.
- Elevation `e = asin(clamp(v·up/|v|, -1, 1))` in degrees. Bands follow Requirement 3.2 exactly. The bands are
  total and disjoint because the middle band is open and its neighbours are closed on the shared edge.
- Standard rig (metres): pelvis `(0, 0.95, 0)`; hips at `x = ±0.09`; shoulders at `x = ±0.18`, `y = 1.42`; neck
  `(0, 1.45, 0)`; head `(0, 1.6, 0)`; arm length (shoulder to wrist) 0.6; leg length (hip to ankle) 0.9.
  Right is `+x`. Elbow and knee are the midpoints of their bones (no bend model in this spec).
- Ids: notation writes ids as `${column}-${n}`. `mirrorScore` swaps a leading `left-` / `right-` in ids, so the
  mirrored score carries the same ids that `notateGestures` gives the mirrored frames (property 7.4).
- `canonicalScore` orders columns by `COLUMN_ORDER = [left-support, left-leg, left-arm, right-support, right-leg,
  right-arm]`, then by start, then by duration. It builds objects with a fixed key order, so equal scores serialise
  to the same JSON.
- Times: `beat = t * tempo / 60`. Frame times are seconds from the first frame in notation.

## Decisions (where the requirements leave room, or contradict each other)

- **D1 Move boundaries (4.4 vs 5.2).** The ease in 5.2 has zero speed at both ends of a move, so a move whose
  angular speed is above `stillSpeed` starts late and ends early. Notation finds the run of frames above `stillSpeed`
  (the "moving" test of 4.4), then extends it outwards through frames above `REST_SPEED = 1 deg/s`. The symbol starts
  at the last frame before the run and ends at the last frame of the extended run. The boundary error is at most one
  frame of the 30 fps clock. This is derived from the sampling, not measured. The 5.2 playback and the 4.4 notation
  are both kept as written.
- **D2 Leg lift (4.7).** A leg symbol is written only if its ankle is above `min ankle y + liftHeight` at every frame
  from the symbol's start to its end. The "lowest ankle" is taken over both feet and all frames of the clip.
- **D3 Minimum hold (4.3).** A move whose destination dwell (time until the next move in that column, or until the end
  of the clip) is shorter than `minHold` is dropped. A move that ends in the cell the limb already holds is dropped.
- **D4 Zero limb vector.** Notation keeps the previous cell for a zero vector. `quantizeGesture` throws on zero.
- **D5 Validation adds `grid > 0`.** Without it the multiple-of-grid test in 1.3 has no meaning.
- **D6 Missing start cell.** `performGestures` treats a column with no `startPosition` entry as `place low` (arm
  or leg hanging straight down).
- **D7 Support columns.** `performGestures` ignores symbols in support columns in this spec.
- **D8 Rounding.** Start and end are rounded to integer grid counts. Start is clamped to the previous symbol's end,
  and duration is `max(1, endK - startK)` grid units. Symbols therefore carry exact `k * grid` floats.

## Correctness properties (Requirement 7)

Each property runs with `fc.assert(..., { numRuns: 200 })` or more. Generators are named as in `test/generators.ts`.

| ID | Property | Checks | Generators | File |
|---|---|---|---|---|
| P7.1 | For any non-zero `v` and any axes, the set of cells whose band interval contains `v` has exactly one member, `quantizeGesture(v)` is that member, and `quantizeGesture(cellCenter(c))` is `c` for each of the 26 cells | Req 3.1–3.4 | `arbNonZeroVector`, `arbAxes` | `quantize.prop.test.ts` |
| P7.2 | Rotating `v`, `right`, `forward` by the same yaw about `up` gives the same cell | Req 3, 2 | `arbNonZeroVector`, `arbAxes`, `arbYaw` | `quantize.prop.test.ts` |
| P7.3 | `mirrorScore(mirrorScore(s))` equals `s` | Req 6.1 | `genGestureScore` | `mirror.prop.test.ts` |
| P7.4 | `canonicalScore(notateGestures(mirrorFrames(f)))` equals `canonicalScore(mirrorScore(notateGestures(f)))` for `f = performGestures(s)` | Req 4, 6.1, 6.2 | `genGestureScore` | `mirror.prop.test.ts` |
| P7.5 | `canonicalScore(notateGestures(performGestures(s)))` has the same (column, start, duration, direction, level) list as `canonicalScore(s)` for `s` from `genGestureScore` | Req 4, 5 | `genGestureScore` | `roundtrip.prop.test.ts` |
| P7.5d | Diagnostic (not 7.5): the same check on `genArmSprintScore`, where every move is fast enough for the speed rule of 4.4 | Req 4.4 | `genArmSprintScore` | `roundtrip.prop.test.ts` |
| P7.6 | `performGestures(retime(s, 2))` at frame k equals `performGestures(s)` at frame 2k (times differ by a factor of 2) | Req 6.3, 5 | `genGestureScore` | `tempo.prop.test.ts` |
| P7.7 | `validateScore(notateGestures(f, o)).ok` for `f` from `genGestureScore` performance and from `genRandomFrames` | Req 4, 1.3 | `genGestureScore`, `genRandomFrames` | `notate.prop.test.ts` |

### Generators

- `arbNonZeroVector`: `Vec3` with components in [-1, 1], filtered to length > 1e-6.
- `arbYaw`: degrees in [0, 360).
- `arbAxes`: axes from a random yaw about `up`. Built with `bodyFrame` from a random horizontal direction.
- `genGestureScore`: tempo in {60, 90, 120, 150, 180}, `grid = 0.5`, `beatsPerBar = 4`. For each of the four
  gesture columns: a start cell from `GESTURE_CELLS`, then 0 to 4 symbols. Each symbol has duration `m * grid` with
  `m` in {2, 3, 4, 6, 8}. Gaps to the previous end are `g * grid` with `g` in {1, 2, 3}. Each cell differs from the
  one before it in the same column. Every symbol is valid by construction, and `validateScore` is asserted in the
  generator's tests.
- `genArmSprintScore` (diagnostic only): arms only, tempo in {120, 150, 180}, every duration 2 grid units, and the
  gap rule as above.
- `genRandomFrames`: 2 to 12 frames at increasing times, every joint a random vector in [-1, 1] m (not generated
  as a gesture).

### Expected status

P7.5 fails. Two conflicts in the requirements cause the failures, and the code follows the requirements as written:

1. **Speed rule (4.4 against 5.2).** The smallest move between adjacent cells, for example `forward high` to
   `right-forward high`, is 31.4° (measured in `known-limits.test.ts`). A one-beat move of that size at 60 bpm peaks at
   47.03 deg/s at 30 fps, under the 60 deg/s of 4.4, so notation writes nothing. This is the shrunk counterexample
   from `roundtrip.prop.test.ts`: tempo 60, one right-arm symbol of 1 beat, `forward high` to `right-forward high`.
2. **Lift rule (4.7).** 4.7 measures height above the lowest ankle of the clip. When every ankle of the clip stays at
   the same height, the foot that moves is at the clip minimum and counts as on the floor. In the counterexample at
   120 bpm, all four limbs start at `forward high`. The clip minimum is 1.586 m and the right ankle is at 1.611 m, a
   margin of 0.024 m, below the 0.10 m lift margin. So no right-leg symbol is written. The shrunk counterexample of
   the fast-tempo diagnostic is this kind of case. A foot 1.6 m above the ground is still treated as on the floor.
   Measured in `known-limits.test.ts`.

The diagnostic P7.5d (arms only, one-beat symbols at 120 to 180 bpm) is separate from P7.5 and is not a substitute
for it. It removes both conflicts by construction and checks that notation and playback agree for fast arm moves.

Requirement 4.7 needs an owner decision. Options: measure the lift against the floor (y = 0), or against the
stance foot. Requirement 4.4 needs a speed rule that scales with the duration, or a displacement rule.
