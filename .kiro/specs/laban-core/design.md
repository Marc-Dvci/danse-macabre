# Design: laban-core

Implements `requirements.md` in `packages/core/src`. Public API is exported from `src/index.ts` only.

## Modules

| File | Contents | Requirements |
|---|---|---|
| `types.ts` | `Vec3`, `Frame`, `JointName`, `ColumnId`, `Direction`, `Level`, `Cell`, `Symbol`, `Score`, `BodyAxes`, `ValidationResult` | 1.1 |
| `vec.ts` | Vector helpers: `add`, `sub`, `scale`, `dot`, `cross`, `length`, `normalize`, `angleDeg` | 2, 3 |
| `score.ts` | `GESTURE_COLUMNS`, `COLUMN_ORDER`, `DIRECTIONS`, `LEVELS`, `validateScore`, `canonicalScore` | 1 |
| `body-frame.ts` | `WORLD_AXES`, `bodyFrame(frame, previous?)` | 2 |
| `quantize.ts` | `SECTOR_NAMES`, `GESTURE_CELLS` (26 cells), `quantizeGesture(v, axes)`, `cellCenter(cell, axes)`, internal `sectorIndex(azimuth)` and `cellMargin(v, cell, axes)` | 3 |
| `held-cells.ts` | `hysteresisCells(vectors, axes, hysteresis)` (4.8), `heldCells(raw, times, minHold, endTime)` (4.3) | 4.3, 4.8 |
| `segment.ts` | `angularSpeeds`, `smooth`, `restFrames` (4.4 rests), `holdFrames` (4.4 holds), `moveEdges` (4.4 move edges) | 4.4 |
| `rig.ts` | `Rig`, `standardRig()`, `buildFrame`, `limbBaseJoint(column)`, `limbEndJoint(column)` | 5.1, 5.3 |
| `interpolate.ts` | `slerp(u0, u1, k)` with the antipodal case, `smoothstep(u)` | 5.2 |
| `perform.ts` | `performGestures(score, options?)` | 5 |
| `notate.ts` | `notateGestures(frames, options)`: orchestrates held cells, rests and holds, moves, leg lift filter, grid rounding | 4 |
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
cellMargin(v: Vec3, cell: Cell, axes: BodyAxes): number; // degrees from v to the nearest cell boundary
holdFrames(vectors: Vec3[], times: number[], raw: number[], speedRests: number[], dwellTime: number, dwellAngle: number): number[]; // 4.4 holds, internal
validateScore(score: Score): { ok: true } | { ok: false; errors: string[] };
canonicalScore(score: Score): Score;
standardRig(): Rig;
performGestures(score: Score, options?: { fps?: number; rig?: Rig }): Frame[];
notateGestures(frames: Frame[], options: NotateOptions): Score;
  // NotateOptions = { tempo; beatsPerBar; grid; title; minHold?; smoothing?; restSpeed?; hysteresis?; liftHeight?;
  //                   dwellTime?; dwellAngle? }
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
- Quantisation: `a = atan2(v·right, v·forward)`; elevation `e = asin(v·up / |v|)`; bands per Requirement 3.2.
  Sector `sectorIndex(a)` per Requirement 3.3: the nearest centre, and a boundary goes to the sector whose centre is
  farther from forward.
- Ids: notation writes `${column}-${n}`. `mirrorScore` swaps a leading `left-` / `right-` in ids.
- `canonicalScore` orders columns by `COLUMN_ORDER`, then start, then duration, with a fixed key order.
- Beats: `beat = t * tempo / 60`. Frame times are seconds from the first frame in notation.

## Notation (Requirement 4)

For each gesture column, in this order:

1. **Vectors.** `v_k = end_k − base_k` (wrist − shoulder, or ankle − hip) for each frame, with the axes of frame `k`.
2. **Hysteresis (4.8), `hysteresisCells`.** A frame's candidate is `quantizeGesture(v_k)`. The held cell changes to the
   candidate only when `cellMargin(v_k, candidate) ≥ options.hysteresis`. A zero vector keeps the held cell. The first
   non-zero frame takes its candidate directly.
3. **Minimum hold (4.3), `heldCells`.** Runs of equal cells from step 2 become the held cell only when the run lasts
   `≥ minHold` (until the next change or the end of the clip). The first run is the start cell.
4. **Speeds (4.4).** Raw angular speed `r[k]` between frames `k−1` and `k` (`r[0] = r[1]`). Smoothed speed `s[k]` is the
   mean of the raw speeds within `smoothing / 2` seconds of frame `k` (prefix sums).
5. **Rests (4.4), `restFrames` and `holdFrames`.** Two kinds of rest, merged into one sorted list.
   (a) A local minimum of `s` is a frame with `s[k] ≤` both neighbours. A flat run of equal minima counts once, at its
   middle frame. Each minimum `m` is a rest when `s[m] < restSpeed` or `s[m] < 0.25 · min(leftPeak, rightPeak)`. The
   peaks are the maxima of `s` between `m` and the adjacent minima (or the clip ends). Frames 0 and `n−1` are always
   rests.
   (b) A hold, from `holdFrames`: a run that starts at frame `i`, ends at the last frame `j` whose vector is within
   `dwellAngle` of the vector at `i`, and lasts at least `dwellTime` (`t_j − t_i ≥ dwellTime`). The first frame `i`
   must have raw speed `r[i] < 0.05 · max r over (p, i]`, where `p` is the last rest before `i` (Requirement 4.4 rule b,
   owner answer 1, D18). Frame 0 is exempt. The last frame `j` must have raw speed `r[j] < 0.05 · max r over (j, q]`,
   where `q` is the first speed rest after `j` (or `n−1`) (Requirement 4.4 rule b, owner extension, D19). The last frame
   `n−1` is exempt, and so is a move with no motion. The hold ends at the largest frame `j` within the angle reach that
   passes the speed test and lasts at least `dwellTime`. Otherwise no hold starts at `i`. The search then resumes at
   `j + 1` after a hold, otherwise at `i + 1`. Every frame from `i` to `j` is a rest (D17).
6. **Moves and edges (4.4), `moveEdges`.** For consecutive rests `a < b`, the motion frames are `k ∈ (a, b]` with
   `r[k] ≥ 0.05 · max r over (a, b]`. The move starts at the frame before the first motion frame and ends at the last
   motion frame. A move with no motion is skipped. Consecutive rests inside one hold give a move whose two ends hold the
   same cell, so step 7 skips it.
7. **Move symbols.** For each move with start frame `p` and end frame `q`: the start cell is `held[p]`, the settled cell
   is `held[q]`. Skip the move when the cells are equal, or when `held[q]` holds for less than `minHold` after `q`.
   Otherwise the move gives one symbol for the settled cell.
8. **Lift (4.7, leg columns only).** Keep a leg move only when `ankle_own.y − ankle_other.y > liftHeight` in every frame
   from `p` to `q`.
9. **Grid (4.5).** `startK = round(t_p · tempo/60 / grid)`, clamped to the previous symbol's end. `endK = round(t_q ·
   tempo/60 / grid)`. `durK = max(1, endK − startK)`.

## Decisions

- **D1 (dropped).** The earlier move-boundary decision is replaced by Requirement 4.4.
- **D2 (dropped).** The earlier lift decision is replaced by Requirement 4.7.
- **D3 Minimum hold (4.3).** Applied to runs of cells after hysteresis (step 3). A one-frame blip never becomes a held
  cell. Covered by `notate.test.ts` ("ignores a cell that holds for less than minHold").
- **D4 Zero limb vector.** Notation keeps the held cell. `quantizeGesture` throws on zero. In `holdFrames`, `angleDeg`
  gives 0 for a zero vector, so a zero vector counts as inside a hold.
- **D5 Validation adds `grid > 0`.** Without it the multiple-of-grid test in 1.3 has no meaning.
- **D6 Missing start cell.** `performGestures` treats a column with no `startPosition` entry as `place low`. A zero
  vector in frame 0 gives the same default.
- **D7 Support columns.** `performGestures` ignores symbols in support columns in this spec.
- **D8 Rounding.** Start and end are rounded to integer grid counts. Symbols carry exact `k * grid` floats.
- **D9 Generator start.** The first symbol of each column starts at 1 to 3 grid units, so a limb has a rest before
  its first move.
- **D10 Leg cells in the generator (7.5).** A leg symbol is a leg gesture, so its foot is off the floor during the
  symbol (4.7). The generator draws leg cells from `LIFTED_LEG_CELLS` (every cell except the `low` band and `place low`).
- **D11 (replaced).** The earlier tie tolerance on the smoothed minimum is removed. Symbol edges come from the raw
  speed (D13).
- **D12 Test data path.** `macarena.test.ts` imports the JSON clip. `tsconfig.json` sets `resolveJsonModule`.
- **D13 Symbol edges from raw speed (4.4).** Requirement 4.4 defines rests on the smoothed speed. The symbol's time edges
  are taken from the raw speed inside the rest-to-rest interval, with the threshold `0.05 · peak`. The smoothing window
  would move each edge by up to half its width. The 5% threshold was picked from the shape of the ease curve before any
  test ran. It has not been measured against the round trip alone. Owner to confirm (task 12.3).
- **D14 Hysteresis margin (4.8).** `cellMargin` is the smallest angle from the vector to a band edge of the candidate cell,
  or to one of its two sector planes. For a sector cell, the plane distance `asin(|v·n| / |v|)` is used. It is never
  larger than the distance to the boundary segment, so the margin is conservative.
- **D15 Boundary tolerance (3.3).** `sectorIndex` treats an azimuth as on a boundary when it is within `1e-9` sector units
  (`4.5e-8` degrees) of a boundary. Float noise from `atan2` can move an exact boundary by about `1e-14` sectors, so
  mirrored vectors agree.
- **D16 Seed hook (tests).** `runOptions(n)` in `test/generators.ts` reads the environment variable `FC_SEED` and passes it
  to fast-check as `seed`. A non-integer value throws. Without the variable the run is random, as before.
- **D17 Holds are rests (4.4 rule b).** Owner decision (answer 1 and 2). A hold is a rest from its first frame to its
  last frame, with `dwellTime` 0.35 s and `dwellAngle` 8 degrees. Each hold frame is added to the rest list, so a
  sway inside a hold never starts a move. The hold rule is anchored at the vector at the start of the window, so its
  window can include the slow end of a neighbouring move. The arrival side of that effect is fixed by D18. The
  departure side is Known limit 4.
- **D18 Hold start after the slow tail (4.4 rule b, owner answer 1 and Requirement 4.4 text).** A hold's first frame
  must have raw speed below 5% (`MOVE_EDGE_FRACTION`) of the peak raw speed of the move before it. The move before it
  runs from the last rest before the hold. So the slow end of an arrival stays in the move, and the hold starts after
  the move's last motion frame. `holdFrames` takes `raw` and the speed rests for this check. Covered by
  `test/hold-frames.test.ts`: a fast 90° arrival at frame 10 followed by a slow drift must give a hold starting at frame
  11, not 10.
- **D19 Hold end before the slow start of a move (4.4 rule b, owner extension).** A hold's last frame `j` must have raw
  speed below 5% (`MOVE_EDGE_FRACTION`) of the peak raw speed of the move after it. That move runs from `j` to the first
  speed rest after `j`. This keeps the slow start of a departure in the move, so the symbol starts at the departure, not
  after it. `holdFrames` takes the same inputs as before. The clip's last frame and a move with no motion are exempt.
  Covered by `test/hold-frames.test.ts`. Measured by P7.4 and P7.5 at seeds 1, 42, 1234, 99991 and 2024 (all pass), and
  by the full core suite (51 of 51 pass). The seeds and counts are in the report of this session.

## Known limits

1. **Resolved (Requirement 4.4).** The transit cells are no longer written. `test/known-limits.test.ts` pinned the old
   rule and the owner has removed it.
2. **Resolved (Requirement 3.3).** The boundary rule is mirror-symmetric (D15). The earlier float-dependent failure of
   P7.4 is not reproduced in the seeds listed under Properties.
3. **Resolved for the Macarena by holds (Requirement 4.4 rule b, D17).** Before holds the whole clip gave 4 arm symbols,
   and the left arm's `forward middle` hold (0.80 s to 2.23 s) had no rest. With holds and the first-frame rule (D18)
   the Macarena test prints 10 arm symbols in total after D19 (12 after D18, 16 before D18), and the first left-arm symbol is `forward middle`
   at beat 1 (0.6 s at 100 bpm). The right arm's first symbol is `forward middle` at beat 1.5. No constant was tuned.
4. **Resolved (Requirement 4.4 rule b, D19).** The last frame of a hold must be slow relative to the move after it. The
   departure case that failed P7.5 (counterexample: tempo 60, one left-leg symbol `right-forward high` at start 0.5 beat,
   duration 1 beat, notated at start 1 beat with duration 0.5 beat) is covered by the fix. The notate example test
   "writes one symbol for the cell the arm settles in" passes after D19.

## Correctness properties (Requirement 7)

Each property runs with `numRuns: 200` or 500. Generators are in `test/generators.ts`.

| ID | Property | Requirement | File | Status |
|---|---|---|---|---|
| P7.1 | Exactly one of 26 cells contains each non-zero vector; `cellCenter` quantises back | 3.1–3.4 | `quantize.prop.test.ts` | pass |
| P7.2 | Yaw of vector and axes together gives the same cell | 3, 2 | `quantize.prop.test.ts` | pass |
| P7.3 | `mirrorScore(mirrorScore(s)) = s` | 6.1 | `mirror.prop.test.ts` | pass |
| P7.4 | `canonical(notate(mirrorFrames(f))) = canonical(mirrorScore(notate(f)))` | 4, 6 | `mirror.prop.test.ts` | pass at seeds 1, 42, 1234, 99991, 2024 (after D19), and in the unseeded full core run |
| P7.5 | Round trip of symbols for the 7.5 domain (`genGestureScore`) | 4, 5 | `roundtrip.prop.test.ts` | pass at seeds 1, 42, 1234, 99991, 2024 (after D19), and in the unseeded full core run |
| P7.6 | `performGestures(retime(s, 2))` at frame k equals `performGestures(s)` at 2k | 6.3, 5 | `tempo.prop.test.ts` | pass |
| P7.7 | `validateScore(notate(f)).ok` for generated performances and random frames | 4, 1.3 | `notate.prop.test.ts` | pass |

The diagnostic P7.5d (arm-only sprints) was removed earlier. It tested the 60 deg/s rule of the superseded Requirement 4.4.

### Generators

- `arbNonZeroVector`, `arbYaw`, `yawVector`, `yawAxes`, `arbAxes` (from `WORLD_AXES`, so right is −x).
- `genGestureScore` (7.5 domain): tempo integer 60 to 180; `grid = 0.5`; each arm column 0 to 4 symbols; the leg side
  is left, right or none, with 0 to 3 leg symbols on that side only (D10); durations 2 to 8 grid units; gaps 1 to 3
  grid units; each cell differs from the limb's previous cell; the other leg stays at `place low`.
- `genRandomFrames`: 1 to 12 frames of random joints in [-1, 1] m.
- `runOptions(n)`: `{ numRuns: n }`, plus `seed` from `FC_SEED` when set (D16).

## Requirement 8

- `macarena.test.ts` loads `data/clips/macarena.json` (CMU subject 143, trial 35).
- 8.1 checks frame 0 forward against (−0.48, 0, −0.88) at one decimal place. Passes. Measured: (−0.511, 0.000, −0.859).
- 8.2 notates at 100 bpm. It logs the raw cells of the first 4 s, the rests (including holds) of both arms, the total
  number of arm symbols and the first eight. It asserts that the first symbol of each arm is `forward middle` with start
  at most 2 beats. Passes after D19 with 10 arm symbols in total (measured by `vitest run test/macarena.test.ts`). The
  first eight: left-arm `forward middle` at 1, right-arm `forward middle` at 1.5, left-arm `left-forward high` at 5.5,
  right-arm `right low` at 5.5, left-arm `backward low` at 6, left-arm `forward middle` at 7, right-arm `forward middle`
  at 7, left-arm `right-forward middle` at 11.5. No constant was tuned. The 12-symbol count of D18 and the 16-symbol
  count before D18 are not reproduced by the current run.

## Notation tests

- `notate.test.ts`: "keeps the held cell for a limb resting within the hysteresis width of a boundary" (hysteresis 4)
  and its control with hysteresis 0. The arm alternates every 0.5 s between 21° and 24° of elevation, around the
  22.5° middle/high boundary.
- `notate.test.ts`: "writes one symbol for the cell the arm settles in, not for the cells it passes through". Passes
  after D19.
- `quantize.test.ts`: boundary azimuths 22.5, 67.5, 112.5, 157.5 and their negatives go to the sector farther from forward.
