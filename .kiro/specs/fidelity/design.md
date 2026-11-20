# Design: fidelity

Builds on `laban-core` (notation, `perform`, `footContacts`, `bodyFrame`) and `supports-and-turns` (`perform` with
steps and turns). Requirements: `requirements.md` in this folder.

## Modules

| Module | Status | Contents |
|---|---|---|
| `src/fidelity.ts` | new | `replayFidelity`, the per-limb angle measure |
| `src/fidelity-stats.ts` | new | `mean`, `median`, `percentile` over a list of numbers (no dependencies) |
| `src/notate.ts` | changed (Req 2.1) | the leg lift filter reads one frame, the end of the move |
| `scripts/fidelity-report.ts` | new | Requirement 3 table for the nine clips |
| `docs/measure/fidelity.md` | new | the saved "before" and "after" tables and the commands that produced them |

`index.ts` gets one new export line: `export { replayFidelity, type FidelityOptions, type FidelityResult } from './fidelity';`.

## Public API

```ts
// fidelity.ts
export type FidelityOptions = {
  /** Frames per second of the replay. Default: the recording's own rate, 1 / (t[1] - t[0]). */
  fps?: number;
  /** Passed to `perform`. Default 0.4 m. */
  stepLength?: number;
  /** Passed to `perform`. Default `standardRig()`. */
  rig?: Rig;
  /** Foot-off-floor height for leg frames, metres (laban-core Requirement 4.7). Default 0.10. */
  liftHeight?: number;
};

export type Limb = 'left-arm' | 'right-arm' | 'left-leg' | 'right-leg';

export type FidelityResult = {
  meanDegrees: number;
  medianDegrees: number;
  p90Degrees: number;
  perLimb: Record<Limb, number>;   // mean per limb; NaN when the limb has no counted frame
  frames: number;                  // frames compared (recording frames, up to the end of the replay)
};

export function replayFidelity(recording: Frame[], score: Score, options?: FidelityOptions): FidelityResult;
```

```ts
// fidelity-stats.ts
export function mean(values: number[]): number;            // NaN for []
export function median(values: number[]): number;          // NaN for []
export function percentile(values: number[], p: number): number; // p in [0, 1], linear interpolation (type 7); NaN for []
```

## Algorithm

1. `replay = perform(score, { fps, stepLength, rig })`. `fps` defaults to the recording rate.
2. For frame `k` from 0 to `min(recording.length, replay.length) - 1`:
   - Body axes: `rec_axes[k] = bodyFrame(recording[k], rec_axes[k-1])`, and the same for the replay. The chain of
     previous axes is the one `notateGestures` uses, so both sides use the same convention.
   - For each limb, the segment is `arm: wrist − shoulder`, `leg: ankle − hip` (left and right hip and ankle).
   - Express each segment in its frame's own axes: `(dot(v, right), dot(v, up), dot(v, forward))`. Coordinates in one
     frame only. Position and facing drop out.
   - Angle `θ = acos(clamp(a·b / (|a||b|), −1, 1))` in degrees. A zero-length segment gives no sample.
3. A leg sample is counted only when the recorded foot is off the floor in frame `k`:
   `recording[k].joints[ankle].y − recording[k].joints[other ankle].y > liftHeight`.
4. Over all counted samples: `meanDegrees`, `medianDegrees`, `p90Degrees` (`percentile(·, 0.9)`). `perLimb` is the mean
   of each limb's samples.

## Decisions

- **D1. Body frame of the measure.** The measure uses `bodyFrame` from `body-frame.ts`, the same as the notator. Using
  one convention for both sides means a score that is performed and notated again measures against itself.
- **D2. Coordinates, not a quaternion.** Comparing the two coordinate triples gives the angle between the limb directions
  in each frame's own axes. It is zero when the performed limb matches the recorded limb up to a rotation of the body.
- **D3. Length mismatch.** `perform` runs one beat past the last symbol. Frames past the recording are not compared.
  If the replay is shorter than the recording, the comparison stops at the replay's last frame, and `frames` shows the
  count.
- **D4. Legs use the recording.** The lift test reads the recorded ankles, not the replayed ones. A foot that the score
  puts in the air but the dancer keeps on the floor is not compared. This is the Requirement 1.3 wording.
- **D5. No constant is tuned.** `liftHeight` is the laban-core default. Requirement 3.2 forbids tuning to improve the
  table.

## Requirement 2 change (leg lift at the end of a move)

`notateGestures` (notate.ts, the lift filter) currently keeps a leg move only when every frame from `move.start` to
`move.end` has the ankle above the other ankle by `liftHeight`. The change: keep the move when frame `move.end` alone
passes. The rising part of a kick no longer cancels the symbol. Nothing else in the notator changes: the move edges,
the grid, the minimum hold and the support filter in `notate` stay as they are.

## Correctness properties

Property tests: `test/fidelity.prop.test.ts`. Example tests: `test/fidelity.test.ts`.

| # | Property | Checks | Test |
|---|---|---|---|
| F1 | For a generated gesture score `s`, `replayFidelity(performGestures(s), s).meanDegrees < 1` and `p90Degrees < 1`. | Req 1.4 | prop, `fc.assert` over `genGestureScore` |
| F2 | For a recording `r` rotated about the vertical axis and translated by any `(dx, dy, dz)`, the result equals that of `r` up to 1e-6 degrees. | Req 1.1 (position and facing do not count) | prop, over `fc.double` offsets and angles, using a gesture score from `genGestureScore` as the replay |
| F3 | `0 ≤ meanDegrees ≤ 180`, `medianDegrees` and `p90Degrees` are in `[0, 180]`, and `median ≤ p90`. | Req 1.2 | prop, over generated scores and recordings |
| F4 | A recording whose ankles are both at the same height in every frame has no leg samples: `perLimb['left-leg']` and `perLimb['right-leg']` are NaN. | Req 1.3 | example |
| F5 | `frames ≤ recording.length`. | D3 | prop |

Requirement 2.2 is not a new property. It is the existing laban-core property suite, run at five seeds.

## Known limits

- The measure compares limbs, not the face or the trunk. A score that gets every limb right while the torso leans
  wrongly still scores well.
- The replay of a score with steps uses `perform`, so a recording with a different floor height than the rig shows
  error in the leg frames.
