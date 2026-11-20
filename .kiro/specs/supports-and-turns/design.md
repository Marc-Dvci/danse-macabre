# Design: supports-and-turns

Implements `requirements.md` in `packages/core/src`. Public API is exported from `src/index.ts` only. Conventions
are in `.kiro/steering/notation.md`. Builds on `laban-core` (`design.md` there, decisions D1 to D19).

## Modules

| File | Contents | Requirements |
|---|---|---|
| `types.ts` | `DirectionSymbol`, `TurnSymbol`, `Symbol` (union), `Score` | 2 (turn symbol shape) |
| `symbol.ts` | `isTurnSymbol`, `isDirectionSymbol`, `directionSymbols(score)` | 2 |
| `score.ts` | `validateScore`, `canonicalScore` extended for turns and support columns | 1.3, 2 |
| `mirror.ts` | `mirrorScore` extended: turn columns and rotations swap | 1.5 (mirror rule in notation.md) |
| `contact.ts` | `footContacts(frames, options)`, `standingHeight(pelvisHeights, contacts)` | Glossary, 1.4 |
| `support-axes.ts` | `yawDeg(axes)`, `bodyAxesFromYaw(yawDeg)`, `horizontalVector(direction)`, `SUPPORT_LEVEL_HEIGHTS` | 1.3, 3.1, 2.2 |
| `notate-supports.ts` | `notateSupports(frames, options): Symbol[]` | 1, 2 |
| `notate.ts` | `notate(frames, options): Score` (gestures + supports, leg filter) | 1.5 |
| `perform-body.ts` | `bodyState(score, t, rig)`: pelvis, yaw, anchors, body joints | 3 |
| `perform.ts` | `perform(score, options): Frame[]`; `performGestures` unchanged | 3 |
| `index.ts` | exports `notate`, `perform`, `notateSupports`, `TurnSymbol`, `DirectionSymbol`, `isTurnSymbol` | — |

Tests: `packages/core/test/`. Example tests `*.test.ts`, properties `*.prop.test.ts` with `runOptions(200)` from
`test/generators.ts`. Real-data example: `test/clips-supports.test.ts`.

## Types

```ts
type DirectionSymbol = { id; column: ColumnId; start; duration; direction; level; kind?: 'direction' };
type TurnSymbol = { id; kind: 'turn'; column: 'left-support' | 'right-support'; start; duration;
                    rotation: 'cw' | 'ccw'; amount: 0.25 | 0.5 | 0.75 | 1 };
type Symbol = DirectionSymbol | TurnSymbol;
```

A direction symbol without `kind` is still valid (D20). Existing callers that read `direction` or `level` narrow with
`isDirectionSymbol` first. `layoutStaff`, `describe` and `performGestures` skip turn symbols (D25).

## Contact (`contact.ts`)

- `minY` = the lowest ankle height over all frames and both feet.
- Speed of an ankle at frame k: `|p_k − p_{k−1}| / (t_k − t_{k−1})`, with the first frame using frame 1. Speed is the
  3D distance of the ankle joint.
- Frame k is in contact for a foot when `y − minY ≤ contactHeight` and `speed ≤ contactSpeed`.

## Steps (`notate-supports.ts`, Requirement 1)

1. Touchdown and leave events per foot from the contact arrays. A **leave** is the first frame that is not in contact
   after a contact frame. A **touchdown** is the first contact frame after a leave. A foot with no earlier leave gives
   no step at its first touchdown.
2. Step symbol for foot f, from leave frame `a` to touchdown frame `b`:
   - start time `t_a`, end time `t_b`; both rounded to the grid (as laban-core 4.5, durations ≥ 1 grid).
   - direction: horizontal displacement `d = pelvis_b − pelvis_a` (y removed), expressed in the body axes at `a`.
     If `|d| < stepPlace` the direction is `place`. Otherwise it is the sector from `quantizeGesture` of `d` with the
     level ignored (D21).
   - level: pelvis height at `b` compared with `standingHeight`: below 0.93× is `low`, above 1.03× is `high`.
3. `standingHeight` = median pelvis height over frames with both feet in contact (Glossary). When no frame has both feet
   in contact, the rig height 0.95 m is used (D22).

## Turns (Requirement 2)

- Touchdowns are ordered in time: `(k_i, foot_i)`.
- For consecutive touchdowns `i` and `i+1`: the candidate foot is `foot_i`, if it stays in contact on every frame from
  `k_i` to `k_{i+1}`. Otherwise no turn (D23).
- Yaw of the body at a frame: `yaw = atan2(forward.x, forward.z)` in degrees from `bodyFrame`. Positive is
  counter-clockwise seen from above. The signed change Δ is the sum of the wrapped yaw changes of each frame from `k_i`
  to `k_{i+1}`, each wrapped into (−180, 180]. Endpoints alone cannot tell +180 from −180, or a full turn from none (D29).
- Turn when `|Δ| ≥ 67.5`: `rotation = Δ < 0 ? 'cw' : 'ccw'`, `amount = clamp(round(|Δ| / 360 × 4) / 4, 0.25, 1)`.
  Amounts are fractions of a full turn: 0.25 is 90°, 0.5 is 180°, 0.75 is 270°, 1 is 360° (D24).
- Turn symbol window: `[t_{k_i}, t_{k_{i+1}}]` in the column of `foot_i`.
- Step directions after a turn use `bodyFrame` at the step's leave frame, so they use the new facing (Requirement 2.2).

## Leg gestures (Requirement 1.5)

`notate` = `notateGestures` plus `notateSupports`. Leg gesture symbols are kept only when the leg's foot is out of
contact on every frame of the symbol's time window, `[start, start + duration]` in seconds. Arm symbols are not
filtered.

## Playback (`perform.ts`, `perform-body.ts`, Requirement 3)

Body state at time t, computed by walking the steps and turns in time order:

- **Yaw.** Starts at 0°. Each turn of amount `a` adds `−a × 360°` for cw and `+a × 360°` for ccw, eased with
  `smoothstep` over its window.
- **Pelvis.** Each step of foot f over `[t0, t1]` moves the pelvis by `stepLength` (default 0.4 m) along
  `horizontalVector(direction)` in the axes at `t0` (zero for `place`). Eased with `smoothstep`. Height goes from the
  height at `t0` to the level height over the same window: low 0.88, middle 1.0, high 1.05 × 0.95 m (D26).
- **Stepping foot.** Moves from its anchor at `t0` to its new anchor, `pelvis(t1) + hip offset rotated by yaw(t1)`,
  with `smoothstep` in x and z. Its height is `0.2 m × ramp(u)` where `ramp(u) = min(1, u/0.05, (1−u)/0.05)` (D27).
  The foot is above the 0.12 m contact limit from `u = 0.03` to `u = 0.97`, so the detected leave and touchdown differ
  from the true times by at most 0.03 of the step plus one frame.
- **Planted foot.** Anchor at height 0. Anchors are in the world and do not move during turns or other feet's steps.
- **Arms.** Gesture tracks as in `performGestures`, held in body coordinates and mapped to world axes with the yaw at
  time t. Arms follow the body (no arm symbol is written by a turn).
- **Legs.** During a leg gesture symbol the free ankle is `hip + legLength × track direction` in body coordinates. Outside
  a leg gesture symbol and outside a support symbol the ankle is planted at its anchor (D28).
- **Joints.** Shoulders are at `pelvis.y + 0.47` with half width 0.18 m. Hips half width 0.09 m. Elbows and knees sit at
  the midpoint of their bones.

## Correctness properties

| ID | Property | Requirement | File |
|---|---|---|---|
| P8.1 | `notateSupports(perform(s)).supports` equals the support symbols of `s` (steps) | 4.1 | `supports-roundtrip.prop.test.ts` |
| P8.2 | Same, for scores mixing steps and turns | 4.2 | `supports-roundtrip.prop.test.ts` |
| P8.3 | `notateSupports(mirrorFrames(perform(s)))` equals `mirrorScore(s)` support symbols | 4.3 | `supports-mirror.prop.test.ts` |
| P8.4 | Rotating every frame about the vertical axis leaves support symbols unchanged | 4.4 | `supports-facing.prop.test.ts` |
| P8.5 | `validateScore(canonicalScore(s))` is `ok` for generated support scores | 1.3 | `supports-validate.prop.test.ts` |
| P8.6 | `mirrorScore(mirrorScore(s))` equals `s` for scores with turns | mirror rule | `supports-mirror.prop.test.ts` |

Generators (`test/supports-generators.ts`): `genStepScore` (alternating feet, back to back or with a gap of 0 to 2 grid
units, durations 2 to 6 grid units, direction from the 8 horizontal names or `place`, any level, tempo 60 to 180,
grid 0.5) and `genStepTurnScore` (same, plus a turn in the pivot column between consecutive steps with amount 1/4 to 1,
rotations cw or ccw). Each generated turn is at least 90° so it passes the 67.5° threshold after frame sampling.

## Decisions

- **D20** `kind` is optional on direction symbols. Old scores and `notateGestures` output stay unchanged, so
  `canonicalScore` writes no `kind` for them.
- **D21** Step direction ignores the level of the horizontal vector. It is the sector only.
- **D22** `standingHeight` falls back to 0.95 m when no frame has both feet in contact.
- **D23** A turn is written only for the foot that stays in contact between two touchdowns.
- **D24** Turn amount is `round(|Δ|/360 × 4)/4` clamped to [0.25, 1], where Δ is the summed yaw change of D29. The
  67.5° threshold is where the rounded amount first becomes 1/4.
- **D25** `layoutStaff`, `describe` and `performGestures` skip turn symbols. Turns have no staff glyph and no lesson
  phrase in this spec.
- **D26** Pelvis heights use 0.95 m as the standing height in playback (`PELVIS.y` of the rig).
- **D27** Stepping-foot lift is 0.2 m with a ramp of 5% of the step at each end. The 10% ramp of the first draft moved
  detected boundaries by up to 0.06 of a step, which at 6 grid units and 180 bpm plus one frame of sampling could pass the
  half-grid rounding limit. The 5% ramp keeps the error below 0.4 grid at those settings.
- **D29** A turn's amount and sign come from the sum of the per-frame wrapped yaw changes between the two touchdowns. The
  endpoint difference cannot give the sign of a half turn (±180) or a full turn (0).
- **D28** Legs are planted outside their own symbols. The leg's ankle jumps at the start and end of a leg gesture
  window. This is a known limit.
- **D30** The pivot rule allows a one-frame tolerance at the other foot's touchdown. Contact needs low speed as well as
  low height, so a landing foot registers its touchdown up to one frame late. The pivot can lift in that frame. A turn
  therefore ends at the pivot's lift frame when that frame is `b − 1` or later, where `b` is the other foot's touchdown.
  A pivot that lifts earlier gives no turn. Found by the counterexample at 61 bpm: left step 0.5–1.5 beats, cw quarter
  turn 1.5–2.5, right step 1.5–2.5, left step from 2.5. Both feet were off the floor in the frame at 2.467 s.
- **D31** Measured, not changed (Requirement 4.1 and the Glossary). The standing height is the median pelvis height over
  two-foot frames. A clip that spends most of its two-foot time at a high or low level moves that median, so a step
  written at that level is read as `middle`. Counterexample: tempo 60, `left-support 0.5 +1 place high`,
  `right-support 1.5 +1 place high`. The two-foot frames are at 0.95 m (lead-in) and 0.9975 m (after the last step), so
  the standing height is 0.9975 m and both steps read `middle`. The round trip of levels (P8.1, P8.2, P8.3) fails
  for such scores. Options for the owner: (a) take the standing height from the lead-in only, (b) store the standing
  height in the score, (c) keep the median and accept the round trip only for scores whose two-foot time is mostly
  `middle`. Owner decides (question 1 in the report).
- **D32** Open. Step direction is off by 45° in some scores that contain turns (for example `left-forward` read as
  `forward`). The no-level round trips (P8.2 and P8.3 with `withLevel = false`) fail on this. The cause is not found
  yet. The first candidate, the axes at the leave frame compared with the axes at the step start, does not explain a
  45° error for a step that starts after its turn window opens.

## Known limits (this session)

1. Round trip of levels depends on the median in D31.
2. Direction of a step that overlaps a turn is not yet verified (D32).
3. Legs follow a leg gesture only inside that gesture's window. The ankle moves at the window edges (D28).
4. Clips: `russian-dance.json` gives 0 support symbols. Its left ankle is within 0.12 m of the clip's lowest ankle in
   24 of 359 frames, and its right ankle in 12. The contact height rule (not the speed rule) limits the detection. The
   clip's floor reference is not checked against the data. No threshold was tuned (D33, question 3).
