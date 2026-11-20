# Results

Written by `pnpm exec tsx scripts/results.ts` on 2026-11-20. Every figure in the README comes from this file.

## The nine dances, written down

Settings: 100 counts per minute, 4 counts per bar, half-count grid. Source: CMU Graphics Lab Motion Capture Database (subject/trial).

| Dance | CMU | Seconds | Arm symbols | Leg symbols | Steps | Turns | Lesson lines | Lesson parses back | Valid score | Notation time (ms) |
|---|---|---|---|---|---|---|---|---|---|---|
| Macarena | 143/35 | 10.7 | 22 | 0 | 7 | 0 | 23 | yes | yes | 6 |
| Chicken Dance | 143/34 | 6.5 | 14 | 0 | 2 | 0 | 13 | yes | yes | 1 |
| The Twist | 141/12 | 4.7 | 10 | 0 | 29 | 0 | 19 | yes | yes | 1 |
| Russian dance | 90/30 | 12.0 | 19 | 3 | 0 | 0 | 21 | yes | yes | 2 |
| Salsa | 60/01 | 37.4 | 67 | 4 | 65 | 0 | 89 | yes | yes | 7 |
| Modern dance: arms held high | 05/12 | 11.3 | 5 | 4 | 1 | 0 | 10 | yes | yes | 1 |
| Modern dance: expressive arms, pirouette | 05/02 | 9.4 | 10 | 1 | 15 | 0 | 16 | yes | yes | 2 |
| Modern dance: side arabesque | 49/09 | 16.0 | 4 | 0 | 0 | 0 | 6 | yes | yes | 2 |
| Chicken dance (duet, dancer A) | 20/01 | 10.7 | 25 | 0 | 0 | 0 | 22 | yes | yes | 1 |

Total: 307 symbols from 118.7 seconds of dance.

## The skeleton against the recording

Each score is danced by the skeleton and compared with the recording it was written from, frame by frame: the angle between each limb's direction in the two, in each body's own frame (legs only while the recorded foot is off the floor). Labanotation directions are 45 degrees apart, so a limb half-way between two directions is already 22.5 degrees from either.

| Dance | Mean (degrees) | Median | 90th percentile | Frames |
|---|---|---|---|---|
| Macarena | 20.9 | 17.3 | 43.6 | 320 |
| Chicken Dance | 19.0 | 15.9 | 34.0 | 196 |
| The Twist | 37.4 | 32.3 | 72.2 | 142 |
| Russian dance | 21.3 | 15.6 | 41.5 | 352 |
| Salsa | 21.6 | 16.9 | 37.8 | 1121 |
| Modern dance: arms held high | 20.8 | 18.5 | 30.3 | 339 |
| Modern dance: expressive arms, pirouette | 28.6 | 23.9 | 48.9 | 281 |
| Modern dance: side arabesque | 17.0 | 10.5 | 39.0 | 172 |
| Chicken dance (duet, dancer A) | 25.0 | 18.0 | 56.3 | 322 |

Average of the nine means: 23.5 degrees. Method and settings: `docs/measure/fidelity.md`.

Mirror search: in 9 of 9 dances, the first two bars are found, mirrored, at their own beat in the mirrored dance.

First eight arm symbols of the Macarena (CMU 143/35):

- left-arm forward middle at beat 1
- right-arm forward middle at beat 1.5
- left-arm right-forward middle at beat 3.5
- right-arm left-forward middle at beat 4
- left-arm forward middle at beat 4.5
- right-arm forward low at beat 4.5
- right-arm forward middle at beat 5
- left-arm left-forward high at beat 5.5

## The finale

Danse macabre: opening waltz, 16 bars: 80 symbols, 3 counts per bar at 193 counts per minute. 

## Video against motion capture

Measured 2026-11-20 by `pnpm --filter @danse/web measure` (the From video page in Chromium, headless). The CMU reference video of a take is read by the pose model and written down; its arm cells are compared, every half count, with the score written from the motion capture of the same take, after lining the two up by wrist height.

| Video | Symbols from video | Same direction and level | Same or neighbouring | Checks | Offset (s) |
|---|---|---|---|---|---|
| Modern dance: arms held high | 57 | 80% | 83% | 70 | 0.9 |
| Modern dance: expressive arms, pirouette | 52 | 55% | 71% | 58 | 0.7 |

## Tests

- Core tests passed: 154
- Core tests failed: 0
- Core test files: 31
- Core property tests (fast-check): 33
- MCP server tests passed: 45
- MCP server tests failed: 0
- Browser tests passed (Playwright, with axe): 9
- Browser tests failed: 0
