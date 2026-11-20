# Requirements: fidelity (how closely the score reproduces the dance)

## Introduction

A score is only useful if dancing it gives back the dance. This spec adds a measure of that to `@danse/core`, and uses
it to judge two notation rules on the nine real CMU dances in `data/clips/`. Every number in the report must come from
the measure, run on all nine dances.

## Requirement 1: the measure

**User story:** As a judge or a notator, I want one number per dance for how closely its skeleton follows the
recording, so that a notation rule can be judged by what it does to real dances.

1. WHEN `replayFidelity(recording, score, options)` is called THE SYSTEM SHALL perform the score (same fps as the
   recording), and for every frame and for each of the four limbs (two arms, two legs) compute the angle between the
   limb's direction in the recording and in the performed frames, each expressed in its own body frame (so position
   and facing do not count).
2. THE SYSTEM SHALL return `{ meanDegrees, medianDegrees, p90Degrees, perLimb: Record<limb, meanDegrees>, frames }`.
3. Legs count only in frames where the recorded foot is off the floor by the rule of laban-core Requirement 4.7;
   supporting legs are not compared.
4. A test SHALL check the measure on a score's own performance: `replayFidelity(performGestures(s), s)` is below 1
   degree for generated scores.

## Requirement 2: leg gestures on real dances

**User story:** As a dancer, I want a raised leg written down, so that an arabesque or a kick appears in the score.

1. The leg-lift rule of laban-core Requirement 4.7 SHALL apply to where the leg arrives and holds, not to every frame
   of the move: a leg symbol is written WHEN the foot is off the floor (more than `liftHeight` above the other ankle)
   at the end rest of the move. The rising part of a kick, when the foot is still near the floor, no longer cancels
   the symbol.
2. All properties of laban-core Requirement 7 SHALL still pass, at seeds 1, 42, 1234, 99991 and 2024.

## Requirement 3: report

1. A test (or a script under `packages/core/scripts/`) SHALL print, for each of the nine clips, at 100 bpm, grid 0.5:
   the number of symbols per column kind and `replayFidelity` (mean, median, p90, per limb), before and after the
   Requirement 2 change, as one table, and save it to `docs/measure/fidelity.md`.
2. Do not tune any constant to improve the table. If a constant change looks worth making, report the measured effect
   on all nine dances and let the owner decide.
