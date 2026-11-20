# Design: laban-core

Implements `requirements.md` in `packages/core/src`. Public API is exported from `src/index.ts` only.

## Modules

| File | Contents | Requirements |
|---|---|---|
| `types.ts` | `Vec3`, `Frame`, `JointName`, `ColumnId`, `Direction`, `Level`, `Cell`, `Symbol`, `Score`, `BodyAxes`, `ValidationResult` | 1.1 |
| `vec.ts` | Vector helpers: `add`, `sub`, `scale`, `dot`, `cross`, `length`, `normalize`, `angleDeg` | 2, 3 |
| `score.ts` | `GESTURE_COLUMNS`, `COLUMN_ORDER`, `DIRECTIONS`, `LEVELS`, `validateScore`, `canonicalScore` | 1 |
| `body-frame.ts` | `WORLD_AXES`, `bodyFrame(frame, previous?)` | 2 |
| `quantize.ts` | `SECTOR_NAMES`, `GESTURE_CELLS` (26 cells), `quantizeGesture(v, axes)`, `cellCenter(cell, axes)` | 3 |
| `rig.ts` | `Rig`, `standardRig()`, `buildFrame`, `limbBaseJoint(column)`, `limbEndJoint(column)` | 5.1, 5.3 |
| `interpolate.ts` | `slerp(u0, u1, k)` with the antipodal case, `smoothstep(u)` | 5.2 |
| `perform.ts` | `performGestures(score, options?)` | 5 |
| `notate.ts` | `notateGestures(frames, options)`: cell runs, hold filter, speed minima, lift filter, grid rounding | 4 |
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
  // NotateOptions = { tempo; beatsPerBar; grid; title; minHold?; smoothing?; liftHeight? }
mirrorScore(score: Score): Score;
mirrorFrames(frames: Frame[]): Frame[];
retime(score: Score, factor: number): Score;
```

## Fixed conventions

- Axes are right-handed with y up (`.kiro/steering/tech.md`). A dancer facing +z has `right = −x`, so
  `WORLD_AXES = { up: +y, right: −x, forward: +z }`.
- `bodyFrame`: `right` = normalised horizontal mean of (right-hip − left-hip) and (right-shoulder − left-shoulder);
  `forward = normalize(cross(up, right))`. Under 1 cm of horizontal width, it reuses `previous` or `WORLD_AXES`.
- Standard rig (metres): pelvis `(0, 0.95, 0)`; left hip and left shoulder at `x = +`, right at `x = −`; shoulders at
  `y = 1.42`; neck `(0, 1.45, 0)`; head `(0, 1.6, 0)`; arm (shoulder to wrist) 0.6; leg (hip to ankle) 0.9. Elbow and
  knee are bone midpoints.
- Quantisation: `a = atan2(v·right, v·forward)`, sector `k = floor((a + 22.5) / 45) mod 8`; elevation
  `e = asin(v·up / |v|)`; bands per Requirement 3.2.
- Ids: notation writes `${column}-${n}`. `mirrorScore` swaps a leading `left-` / `right-` in ids.
- `canonicalScore` orders columns by `COLUMN_ORDER`, then start, then duration, with a fixed key order.
- Beats: `beat = t * tempo / 60`. Frame times are seconds from the first frame in notation.

## Notation (Requirement 4)

For each gesture column:

1. **Cells.** Quantise each frame's limb vector (wrist − shoulder or ankle − hip). A zero vector keeps the previous cell.
2. **Runs and holds (4.3).** Group frames into runs of equal cells. A run's hold runs from its first frame to the first
   frame of the next run (for the last run, to the last frame plus one frame interval). A run is a cell change when its
   cell differs from the held cell and its hold is at least `minHold`. Short runs leave the held cell unchanged.
3. **Speed (4.4).** Angular speed `s[k]` between frames `k−1` and `k` (`s[0] = s[1]`). Smoothed speed is the mean of
   every `s[i]` with `|t_i − t_k| ≤ smoothing / 2`. Computed with prefix sums.
4. **Boundaries (4.4).** For change `j` at frame `f_j`:
   - `startIdx` = the latest frame in `[end_{j−1}, f_j]` at the smoothed minimum (end_{−1} = frame 0);
   - `endIdx` = the earliest frame in `[f_j, f_{j+1}]` at the smoothed minimum (f_{j+1} = last frame for the final change).
   A frame is at the minimum when its smoothed speed is at most `min + max(2 deg/s, 10% of min)`.
5. **Lift (4.7, leg columns only).** Keep a leg change only when `ankle_own.y − ankle_other.y > liftHeight` in every
   frame of `[startIdx, endIdx]`.
6. **Grid (4.5).** `startK = round(t_start · tempo/60 / grid)`, clamped to the previous symbol's end. `endK` likewise.
   `durK = max(1, endK − startK)`.

## Decisions (where the requirements leave room, or contradict each other)

- **D1 (dropped).** The earlier move-boundary decision was replaced by Requirement 4.4 (speed minima).
- **D2 (dropped).** The earlier lift decision was replaced by Requirement 4.7 (ankle height above the other ankle).
- **D3 Minimum hold (4.3).** Applied to runs of raw cells, as in step 2 above. Covered by the example test
  `notate.test.ts` ("ignores a cell that holds for less than minHold") and by a blip of one frame.
- **D4 Zero limb vector.** Notation keeps the previous cell. `quantizeGesture` throws on zero.
- **D5 Validation adds `grid > 0`.** Without it the multiple-of-grid test in 1.3 has no meaning.
- **D6 Missing start cell.** `performGestures` treats a column with no `startPosition` entry as `place low`.
- **D7 Support columns.** `performGestures` ignores symbols in support columns in this spec.
- **D8 Rounding.** Start and end are rounded to integer grid counts. Symbols carry exact `k * grid` floats.
- **D9 Generator start.** The first symbol of each column starts at 1 to 3 grid units, so a limb has a rest before
  its first move. A move that starts at frame 0 has no rest before it, and 4.4 then has no minimum to find.
- **D10 Leg cells in the generator (7.5).** A leg symbol is a leg gesture, so its foot is off the floor during the
  symbol (4.7). The generator therefore draws leg cells (start cell and symbol cells) from `LIFTED_LEG_CELLS`: every
  cell except the `low` band and `place low`. The arc between two such centres stays above the horizontal, because the
  arc between two unit vectors with non-negative height has non-negative height. The ankle is then at least 0.9 m above
  the stance ankle at `place low` (0.05 m), so 4.7 holds through the symbol.
- **D11 Tie rule (4.4).** `max(2 deg/s, 10%)` as written. The tolerance is absolute near rest, so the chosen minimum
  can sit about one smoothing half-width (0.1 s) from the true rest edge. That could make a round trip round to a
  neighbouring grid unit at fast tempos. This session did not measure it. The round-trip failure seen here comes from
  known limit 1.
- **D12 Test data path.** `macarena.test.ts` imports the JSON clip. `tsconfig.json` sets `resolveJsonModule`, so the
  package code and tests need no Node types.

## Known limits (pinned by `known-limits.test.ts`, and found by the properties)

1. **Moves that cross cells.** Requirement 4.4 writes a symbol for every cell change that holds for `minHold`. A
   move from `place low` to `right middle` passes through `right low`, which holds for longer than 0.12 s at 60 bpm.
   So the notation writes `right low` (1 beat) and then `right middle` at beat 2.5 for 0.5 beats, not beat 1 for
   2 beats. The `right middle` boundary is a speed minimum inside a range with no rest, so it lands on the range's
   edge. Requirement 7.5 fails for this reason, and the same counterexample appears at 60 bpm for a leg.
2. **Boundaries of sectors.** Requirement 3.3 uses half-open sectors. A vector at exactly +22.5° is `right-forward`
   and its mirror at −22.5° is `forward`. In `known-limits` this was not reproduced with a constructed vector: the
   constructed vector gave the symmetric result, because floating-point rounding decides the boundary cases. Requirement
   7.4 failed in two of the four runs of this session with different seeds (`mirror.prop.test.ts`). The first
   counterexample reached frame 10 of a 180 bpm clip where the right-arm azimuth was 22.50 degrees in float. Other
   counterexamples were not traced.

## Correctness properties (Requirement 7)

Each property runs with `numRuns: 200` or 500. Generators are in `test/generators.ts`.

| ID | Property | Requirement | File | Status |
|---|---|---|---|---|
| P7.1 | Exactly one of 26 cells contains each non-zero vector; `cellCenter` quantises back | 3.1–3.4 | `quantize.prop.test.ts` | pass |
| P7.2 | Yaw of vector and axes together gives the same cell | 3, 2 | `quantize.prop.test.ts` | pass |
| P7.3 | `mirrorScore(mirrorScore(s)) = s` | 6.1 | `mirror.prop.test.ts` | pass |
| P7.4 | `canonical(notate(mirrorFrames(f))) = canonical(mirrorScore(notate(f)))` | 4, 6 | `mirror.prop.test.ts` | fails intermittently (limit 2) |
| P7.5 | Round trip of symbols for the 7.5 domain (`genGestureScore`) | 4, 5 | `roundtrip.prop.test.ts` | fails (limit 1) |
| P7.6 | `performGestures(retime(s, 2))` at frame k equals `performGestures(s)` at 2k | 6.3, 5 | `tempo.prop.test.ts` | pass |
| P7.7 | `validateScore(notate(f)).ok` for generated performances and random frames | 4, 1.3 | `notate.prop.test.ts` | pass |

The diagnostic P7.5d (arm-only sprints) was removed. It tested the 60 deg/s rule of Requirement 4.4, which no longer
exists. Requirement 8 tests are in `macarena.test.ts`.

### Generators

- `arbNonZeroVector`, `arbYaw`, `yawVector`, `yawAxes`, `arbAxes` (from `WORLD_AXES`, so right is −x).
- `genGestureScore` (7.5 domain): tempo integer 60 to 180; `grid = 0.5`; each arm column 0 to 4 symbols; the leg side
  is left, right or none, with 0 to 3 leg symbols on that side only (D10); durations 2 to 8 grid units; gaps 1 to 3
  grid units; each cell differs from the limb's previous cell; the other leg stays at `place low`.
- `genRandomFrames`: 1 to 12 frames of random joints in [-1, 1] m.

## Requirement 8

- `macarena.test.ts` loads `data/clips/macarena.json` (CMU subject 143, trial 35).
- 8.1 checks frame 0 forward against (−0.48, 0, −0.88) at one decimal place.
- 8.2 notates at 100 bpm, logs the raw cell runs of both wrists for the first 4 s, and logs the first eight arm
  symbols. It asserts the order the requirement expects. The assertion fails (see the report).
