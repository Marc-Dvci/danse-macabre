# Fidelity measure on the nine clips

Measure: `replayFidelity` (packages/core/src/fidelity.ts). Each clip is written with `notate` at 100 bpm, grid 0.5 beat,
and the score is performed with `perform` at the clip's frame rate. Angles are in degrees between the recorded and the
performed limb direction, each in its own body frame. Legs count only in frames where the recorded ankle is more than
0.10 m above the other ankle.

Clips (CMU Graphics Lab Motion Capture Database, mocap.cs.cmu.edu, free for all uses, no resale; NSF EIA-0196217):
the nine files in `data/clips/`, as listed in `data/clips/index.json`.

## Commands

Before the leg rule change (laban-core Requirement 4.7 applied to every frame of the move):

```
pnpm --filter @danse/core exec tsx scripts/fidelity-report.ts --label before
```

After the change (the lift filter reads the end frame of the move, fidelity Requirement 2.1):

```
pnpm --filter @danse/core exec tsx scripts/fidelity-report.ts --label after
```

Laban-core properties after the change, one seed per command:

```
$env:FC_SEED = "1"; pnpm --filter @danse/core exec vitest run test/roundtrip.prop.test.ts test/mirror.prop.test.ts
$env:FC_SEED = "42"; pnpm --filter @danse/core exec vitest run test/roundtrip.prop.test.ts test/mirror.prop.test.ts
$env:FC_SEED = "1234"; pnpm --filter @danse/core exec vitest run test/roundtrip.prop.test.ts test/mirror.prop.test.ts
$env:FC_SEED = "99991"; pnpm --filter @danse/core exec vitest run test/roundtrip.prop.test.ts test/mirror.prop.test.ts
$env:FC_SEED = "2024"; pnpm --filter @danse/core exec vitest run test/roundtrip.prop.test.ts test/mirror.prop.test.ts
```

Results: 3 tests passed at each of the five seeds (1, 42, 1234, 99991, 2024). The notate test file, run after the
change, passed 7 of 7.

## Before

Output of the "before" command, verbatim:

```
Label: before
| Clip | symbols left-support | symbols right-support | symbols left-leg | symbols right-leg | symbols left-arm | symbols right-arm | mean deg | median deg | p90 deg | left-arm deg | right-arm deg | left-leg deg | right-leg deg | frames compared |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chicken-dance-duet-a | 0 | 0 | 0 | 0 | 1 | 0 | 47.37 | 38.56 | 84.00 | 37.12 | 57.63 | n/a | n/a | 208 |
| chicken-dance | 2 | 0 | 0 | 0 | 1 | 1 | 49.41 | 53.07 | 80.52 | 46.84 | 51.99 | n/a | n/a | 196 |
| macarena | 3 | 4 | 0 | 0 | 7 | 3 | 36.76 | 24.48 | 87.11 | 35.99 | 37.52 | n/a | n/a | 320 |
| modern-arms-high | 1 | 0 | 0 | 0 | 0 | 1 | 28.95 | 20.51 | 38.57 | 34.42 | 22.59 | 29.40 | 31.91 | 334 |
| modern-pirouette | 11 | 4 | 0 | 0 | 1 | 0 | 39.88 | 32.75 | 83.34 | 46.55 | 38.55 | 33.03 | 21.94 | 281 |
| russian-dance | 0 | 0 | 0 | 0 | 0 | 1 | 30.72 | 12.69 | 91.36 | 39.05 | 14.51 | 77.28 | 77.62 | 190 |
| salsa | 34 | 31 | 0 | 0 | 5 | 7 | 38.48 | 26.91 | 82.37 | 35.81 | 43.16 | 29.85 | 30.31 | 1121 |
| side-arabesque | 0 | 0 | 0 | 0 | 1 | 1 | 36.38 | 16.97 | 89.00 | 31.50 | 41.25 | n/a | n/a | 199 |
| twist | 17 | 12 | 0 | 0 | 0 | 0 | 52.96 | 56.64 | 81.84 | 52.25 | 55.31 | n/a | 19.69 | 142 |
```

## After

Output of the "after" command, verbatim:

```
Label: after
| Clip | symbols left-support | symbols right-support | symbols left-leg | symbols right-leg | symbols left-arm | symbols right-arm | mean deg | median deg | p90 deg | left-arm deg | right-arm deg | left-leg deg | right-leg deg | frames compared |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chicken-dance-duet-a | 0 | 0 | 0 | 0 | 1 | 0 | 47.37 | 38.56 | 84.00 | 37.12 | 57.63 | n/a | n/a | 208 |
| chicken-dance | 2 | 0 | 0 | 0 | 1 | 1 | 49.41 | 53.07 | 80.52 | 46.84 | 51.99 | n/a | n/a | 196 |
| macarena | 3 | 4 | 0 | 0 | 7 | 3 | 36.76 | 24.48 | 87.11 | 35.99 | 37.52 | n/a | n/a | 320 |
| modern-arms-high | 1 | 0 | 0 | 0 | 0 | 1 | 28.95 | 20.51 | 38.57 | 34.42 | 22.59 | 29.40 | 31.91 | 334 |
| modern-pirouette | 11 | 4 | 0 | 0 | 1 | 0 | 39.88 | 32.75 | 83.34 | 46.55 | 38.55 | 33.03 | 21.94 | 281 |
| russian-dance | 0 | 0 | 0 | 0 | 0 | 1 | 30.72 | 12.69 | 91.36 | 39.05 | 14.51 | 77.28 | 77.62 | 190 |
| salsa | 34 | 31 | 0 | 0 | 5 | 7 | 38.48 | 26.91 | 82.37 | 35.81 | 43.16 | 29.85 | 30.31 | 1121 |
| side-arabesque | 0 | 0 | 0 | 0 | 1 | 1 | 36.38 | 16.97 | 89.00 | 31.50 | 41.25 | n/a | n/a | 199 |
| twist | 17 | 12 | 0 | 0 | 0 | 0 | 52.96 | 56.64 | 81.84 | 52.25 | 55.31 | n/a | 19.69 | 142 |
```

## Reading the tables

- The two tables are identical. The leg rule change did not change any symbol on these nine clips: no clip has a leg
  symbol before or after, and no statistic moved.
- All leg symbol counts are 0. Leg angles are numbers only where a leg has counted frames (the recorded ankle more
  than 0.10 m above the other ankle): the left leg on modern-arms-high, modern-pirouette, russian-dance and salsa; the
  right leg on those four and on twist. The largest leg angles (russian-dance, 77 degrees on both legs) are in frames
  where the recorded foot is in the air. The replay has no leg symbol there, so the performed leg stays at its planted
  place. This is the likely cause, not measured.
- The cause of the zero leg symbol count was not measured. The attempt to measure ankle heights was stopped by a
  command block (see the session report).
- No constant was changed for either table (fidelity Requirement 3.2).
