# Requirements: laban-core (score model, quantisation, gestures, mirror, tempo)

## Introduction

`packages/core` (`@danse/core`) is the notation engine. It turns frames of joint positions into a Labanotation score
and a score back into frames. This spec covers the score model, the body frame, direction quantisation, gesture
notation and playback for arms and free legs, mirroring and tempo. Supports (steps), turns, the spoken lesson, phrase
search and SVG rendering are separate specs. Conventions: `.kiro/steering/notation.md`.

## Glossary

- **Frame**: `{ t: number /* seconds */, joints: Record<JointName, Vec3> }`, metres, y up.
- **JointName**: `pelvis`, `left-hip`, `right-hip`, `left-knee`, `right-knee`, `left-ankle`, `right-ankle`,
  `left-shoulder`, `right-shoulder`, `left-elbow`, `right-elbow`, `left-wrist`, `right-wrist`, `neck`, `head`.
- **Cell**: a `{ direction, level }` pair. Gesture cells are the 24 pairs of the 8 non-place directions with the 3
  levels, plus `place high` and `place low` (26 cells).
- **Symbol**: `{ id, column, start, duration, direction, level }` with `start` and `duration` in beats.
- **Score**: `{ version: 1, title, tempo /* beats per minute */, beatsPerBar, grid /* beats, default 0.5 */,
  startPosition: Partial<Record<ColumnId, Cell>>, symbols: Symbol[], source? }`.

## Requirement 1: score model and validation

**User story:** As a developer, I want one typed score format, so that the app, the MCP server and the tests agree.

1. THE SYSTEM SHALL export the types `Vec3`, `Frame`, `JointName`, `ColumnId`, `Direction`, `Level`, `Cell`, `Symbol`
   and `Score` from `packages/core/src/index.ts`.
2. WHEN `validateScore(score)` is called THE SYSTEM SHALL return `{ ok: true }` or `{ ok: false, errors: string[] }`,
   with one error per violation.
3. THE SYSTEM SHALL report as errors: a symbol whose start or duration is not a multiple of `grid`; a duration below
   one `grid`; two symbols in the same column that overlap in time; `place middle` in a gesture column; an unknown
   column, direction or level; a non-positive tempo; duplicate symbol ids.
4. WHEN `canonicalScore(score)` is called THE SYSTEM SHALL return the same score with symbols sorted by column then
   start, so that two equal scores serialise to the same JSON.

## Requirement 2: body frame

**User story:** As a notator, I want directions measured from the dancer's own front, so that a turned dancer is
notated the same way.

1. WHEN `bodyFrame(frame)` is called THE SYSTEM SHALL return orthonormal axes `{ up, right, forward }` where `up` is
   world +y, `right` is the horizontal component of the mean of (right-hip − left-hip) and
   (right-shoulder − left-shoulder), normalised, and `forward = normalize(cross(up, right))` (right-handed axes:
   a dancer facing +z has `right` = −x). Checked on real data: in frame 0 of `data/clips/macarena.json` the feet point
   along this `forward`, which is close to (−0.48, 0, −0.88).
2. IF the horizontal component of that mean is shorter than 1 cm THEN THE SYSTEM SHALL reuse the previous frame's
   axes, or world axes (right = −x, forward = +z) for the first frame.

## Requirement 3: direction quantisation

**User story:** As a notator, I want every limb position to fall in exactly one cell, so that notation is never
ambiguous.

1. WHEN `quantizeGesture(v, axes)` is called with a non-zero vector THE SYSTEM SHALL compute the elevation
   `e = asin(v·up / |v|)` and the azimuth `a = atan2(v·right, v·forward)` in degrees.
2. THE SYSTEM SHALL map elevation to a band: `place high` when e ≥ 67.5; `high` when 22.5 ≤ e < 67.5; `middle` when
   −22.5 < e < 22.5; `low` when −67.5 < e ≤ −22.5; `place low` when e ≤ −67.5.
3. THE SYSTEM SHALL map azimuth to the sector k whose centre 45k (mod 360) is nearest, where k = 0, 1, …, 7 names
   `forward`, `right-forward`, `right`, `right-backward`, `backward`, `left-backward`, `left`, `left-forward`. An
   azimuth exactly on a boundary (±22.5, ±67.5, ±112.5, ±157.5) goes to the sector farther from forward, so the
   rule is mirror-symmetric.
4. THE SYSTEM SHALL export `cellCenter(cell, axes)` returning the unit vector at the centre of the cell: elevation 90
   for place high, 45 for high, 0 for middle, −45 for low, −90 for place low, and azimuth 45k.
5. THE SYSTEM SHALL use the arm vector `wrist − shoulder` and the leg vector `ankle − hip`.

## Requirement 4: gesture notation

**User story:** As a dance teacher, I want a clip of arm and leg movements written as a score, so that I can read and
edit it.

1. WHEN `notateGestures(frames, options)` is called THE SYSTEM SHALL return a valid score whose symbols are in the
   columns `left-arm`, `right-arm`, `left-leg`, `right-leg`, with `options = { tempo, beatsPerBar, grid, title }` and
   time zero at the first frame.
2. THE SYSTEM SHALL set `startPosition` from the cells of the first frame.
3. THE SYSTEM SHALL ignore a cell change that lasts less than `options.minHold` seconds (default 0.12 s).
4. THE SYSTEM SHALL split each limb's motion into moves at its rests. A rest is either
   (a) a deep minimum: a local minimum of the smoothed angular speed (centred moving average over
   `options.smoothing` seconds, default 0.2) below a quarter of the lower of its two neighbouring peaks or below
   `options.restSpeed` (default 3 deg/s); or
   (b) a hold: an interval of at least `options.dwellTime` seconds (default 0.35) during which the limb's direction
   stays within `options.dwellAngle` degrees (default 8) of its direction at the start of the interval, and whose
   first frame has a raw angular speed below 5% of the peak speed of the move before it, and whose last frame has a
   raw angular speed below 5% of the peak speed of the move after it (so the slow tail of an arrival and the slow
   start of a departure belong to the moves, not to the hold). A hold is a rest from its first frame (the arrival)
   to its last frame (the departure). Real dancers sway while they hold a
   position, so their speed rarely reaches a deep minimum; holds catch those positions.
   The first and last frames are rests. WHEN the cell the limb holds at the end of a move differs from the cell it
   held at the start of that move, and the new cell then holds for at least `minHold`, THE SYSTEM SHALL write one
   symbol for the new cell. The symbol starts at the first frame after the departure rest where the raw angular speed
   exceeds 5% of that move's peak speed, and ends at the last frame before the arrival rest where it does (decision
   D13). Cells the limb only passes through during a move are not written, as in written Labanotation, where a symbol
   gives the destination.
8. THE SYSTEM SHALL apply a hysteresis of `options.hysteresis` degrees (default 4): a limb resting near a cell
   boundary keeps its previous cell unless its direction is more than that many degrees inside the new cell, so a
   limb held on a boundary does not flicker between two cells.
5. THE SYSTEM SHALL round each symbol's start and end to the nearest multiple of `grid` (in beats, at `tempo`), make
   its duration at least one `grid`, and start it no earlier than the end of the previous symbol in its column.
6. WHILE a limb stays in one cell THE SYSTEM SHALL write no symbol for it.
7. WHERE leg-gesture symbols are written THE SYSTEM SHALL write them only while that foot is off the floor; until the
   supports spec exists, a foot is off the floor when its ankle is more than `options.liftHeight` metres (default
   0.10) above the other ankle in the same frame. So at most one leg is a gesture at any time, as when a dancer
   stands on one foot.

## Requirement 5: gesture playback

**User story:** As a learner, I want the skeleton to perform a score, so that I can see what it means.

1. WHEN `performGestures(score, options)` is called THE SYSTEM SHALL return frames at `options.fps` (default 30) from
   beat 0 to the end of the last symbol plus one beat, using a standard rig (`options.rig`, default
   `standardRig()` with documented segment lengths in metres).
2. THE SYSTEM SHALL hold each limb at the start position before its first symbol, move it from its previous cell
   centre to the new symbol's cell centre over exactly the symbol's duration (spherical interpolation with ease in
   and out), and hold it there after.
3. THE SYSTEM SHALL keep the pelvis fixed at (0, 0.95, 0) and the body facing +z (its right side toward −x) in this
   spec.

## Requirement 6: mirror and tempo

**User story:** As a teacher, I want to mirror a phrase and change its tempo, so that students can learn both sides
at their speed.

1. WHEN `mirrorScore(score)` is called THE SYSTEM SHALL apply the mirror rule of `.kiro/steering/notation.md`.
2. WHEN `mirrorFrames(frames)` is called THE SYSTEM SHALL negate every x coordinate and swap every left joint with its
   right joint.
3. WHEN `retime(score, factor)` is called THE SYSTEM SHALL multiply the tempo by `factor` and leave every symbol's
   beats unchanged.

## Requirement 7: correctness properties (fast-check, at least 200 runs each)

1. Quantisation is total and disjoint: for any non-zero vector, exactly one cell matches, and `cellCenter` of that
   cell quantises back to the same cell.
2. Quantisation does not depend on the dancer's facing: rotating a vector and the axes by the same yaw gives the same
   cell.
3. Mirror is an involution: `mirrorScore(mirrorScore(s))` equals `s` for any valid generated score.
4. Mirror commutes with notation: `canonicalScore(notateGestures(mirrorFrames(f)))` equals
   `canonicalScore(mirrorScore(notateGestures(f)))` for frames produced by `performGestures` of a generated score.
5. Round trip: for any valid generated gesture score at a tempo from 60 to 180 bpm, whose symbols are 2 to 8 grid
   units long, separated by at least one grid unit of stillness in each column, each moving into a cell different
   from the limb's previous cell, and with leg symbols in at most one leg column while the other leg stays at
   `place low`, `canonicalScore(notateGestures(performGestures(s)))` has the same symbols (column, start, duration,
   direction, level) as `canonicalScore(s)`.
6. Tempo: `performGestures(retime(s, 2))` has the same poses as `performGestures(s)` at half the times.
7. Validation: every score produced by `notateGestures` passes `validateScore`.

## Requirement 8: real motion capture

**User story:** As a judge, I want the engine checked on a real dance, not only on its own playback.

1. An example test SHALL load `data/clips/macarena.json` (CMU subject 143, trial 35; format: `{ fps, joints,
   frames: number[frame][joint][xyz] }`) and check the body frame of frame 0 against Requirement 2.1.
2. A test SHALL notate the Macarena at 100 bpm and print the first eight arm symbols (column, start, direction,
   level). The dance opens with both arms stretched forward at shoulder height, one after the other, so the first
   symbol of each arm is expected to be `forward middle` within the first two beats. (In this take the dancer lifts
   the left arm about 0.3 s before the right; the order is not asserted.) Do not tune constants to force a result.
