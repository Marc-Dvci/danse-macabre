# Requirements: supports-and-turns (steps, weight, turns)

## Introduction

Extends `@danse/core` with the support columns: steps (weight transfers), support level, and turns. Builds on
`laban-core` (score model, body frame, gestures). Conventions: `.kiro/steering/notation.md`.

## Glossary

- **Contact**: a foot is in contact when its ankle is within `contactHeight` (default 0.12 m) of the lowest ankle
  height of the clip and moves slower than `contactSpeed` (default 0.35 m/s).
- **Support symbol**: a direction symbol in `left-support` or `right-support`.
- **Turn symbol**: `{ id, kind: "turn", column, start, duration, rotation: "cw" | "ccw", amount: 0.25 | 0.5 | 0.75 | 1 }`
  in a support column. Clockwise is seen from above.
- **Standing height**: the median pelvis height over the frames where both feet are in contact.

## Requirement 1: steps

**User story:** As a dance teacher, I want steps written in the support columns, so that the score shows where the
weight goes.

1. WHEN `notateSupports(frames, options)` is called THE SYSTEM SHALL return support and turn symbols on the same beat
   grid as `notateGestures`.
2. WHEN a foot comes into contact after being free THE SYSTEM SHALL write one support symbol in that foot's column,
   starting when the foot left contact and ending when it regained contact (rounded to the grid as in laban-core
   Requirement 4.5).
3. THE SYSTEM SHALL set the step direction from the horizontal displacement of the pelvis between the start and the
   end of the symbol, in the body frame at the start of the symbol, quantised to the 8 horizontal sectors of
   laban-core Requirement 3.3; `place` when the displacement is shorter than `stepPlace` (default 0.12 m).
4. THE SYSTEM SHALL set the support level from the pelvis height at the end of the symbol: `low` below 0.93 × standing
   height, `high` above 1.03 × standing height, `middle` otherwise.
5. `notate(frames, options)` SHALL return one valid score combining gestures and supports, and SHALL write leg
   gestures only for a leg whose foot is not in contact.

## Requirement 2: turns

**User story:** As a learner, I want turns written as turn signs, so that I know which way to face.

1. WHEN the body-frame yaw changes by at least 67.5 degrees between two consecutive contacts THE SYSTEM SHALL write a
   turn symbol in the column of the supporting foot, with the amount rounded to the nearest quarter (capped at 1) and
   the rotation `cw` when the dancer turned clockwise seen from above.
2. THE SYSTEM SHALL measure step directions after a turn in the new facing.

## Requirement 3: playback

**User story:** As a learner, I want the skeleton to walk the steps and turns, so that I see the whole dance.

1. WHEN `perform(score, options)` is called THE SYSTEM SHALL produce frames that include gestures (laban-core
   Requirement 5), steps and turns: during a support symbol the pelvis travels `stepLength` (default 0.4 m) in the
   symbol's direction (0 for place), the stepping foot moves to its new place and lands at the end, and the pelvis
   height follows the level (low 0.88, middle 1.0, high 1.05 × the rig's standing pelvis height).
2. THE SYSTEM SHALL rotate the whole body about the vertical axis through the pelvis by the turn amount, over the turn
   symbol's duration.

## Requirement 4: correctness properties (fast-check, at least 200 runs each)

1. Round trip: for any valid generated score of steps (alternating feet, at least two grid units each, place or one of
   the 8 directions, any level) `notate(perform(s))` has the same support symbols as `s`.
2. Turn round trip: the same holds for scores mixing steps and quarter, half and full turns.
3. Mirror: `notate(mirrorFrames(perform(s)))` equals `mirrorScore(s)` for generated step scores.
4. Facing: rotating every frame of a clip about the vertical axis leaves the support symbols unchanged.
