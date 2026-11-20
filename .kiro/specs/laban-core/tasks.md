# Tasks: laban-core

Order follows the dependency graph in `design.md`. Ticks mark tasks whose tests pass. Tasks with a failing property or
a failing requirement test stay unticked.

- [x] 1. Types and vector helpers (Req 1.1, 2, 3.1)
  - [x] 1.1 `types.ts` (Vec3 comment states right = −x), `vec.ts`
  - [x] 1.2 Example tests: `vec.test.ts` (add, sub, scale, dot, cross, length, normalize, angleDeg)

- [x] 2. Score validation and canonical form (Req 1.2–1.4)
  - [x] 2.1 Example tests: `validate.test.ts`
  - [x] 2.2 `score.ts`: `validateScore`, `canonicalScore`, `COLUMN_ORDER`
  - [x] 2.3 Example test: `canonical.test.ts`

- [x] 3. Body frame (Req 2)
  - [x] 3.1 Example tests: `body-frame.test.ts` (right = −x for a dancer facing +z, forward = cross(up, right), reuse
        of previous axes under 1 cm)
  - [x] 3.2 `body-frame.ts` (forward = cross(up, right); WORLD_AXES right = −x)
  - [x] 3.3 Requirement 2.2 corrected by the owner to right = −x. Code and tests agree.

- [x] 4. Quantisation (Req 3)
  - [x] 4.1 `generators.ts`: `arbNonZeroVector`, `arbYaw`, `arbAxes`
  - [x] 4.2 Property tests: `quantize.prop.test.ts` (P7.1, P7.2). `inSector` now uses the 3.3 boundary rule.
  - [x] 4.3 `quantize.ts`: `sectorIndex` (3.3 boundary rule with a 1e-9 sector tolerance), `cellMargin` (for 4.8)
  - [x] 4.4 Example tests: `quantize.test.ts` (right = −x; boundary azimuths 22.5, 67.5, 112.5, 157.5 and negatives)

- [x] 5. Rig, interpolation and playback (Req 5)
  - [x] 5.1 `rig.ts` (right side at −x), `interpolate.ts`
  - [x] 5.2 Example tests: `perform.test.ts`
  - [x] 5.3 `perform.ts`

- [ ] 6. Gesture notation (Req 4)
  - [x] 6.1 Example tests: `notate.test.ts`. Covers one symbol per settled cell (4.4), a leg move that ends on the floor
        (4.7), the minHold rule (4.3), and hysteresis (4.8) with a control at 0 degrees. The settled-cell test fails
        after holds (task 6.6, design Known limit 4).
  - [x] 6.2 `held-cells.ts`: `hysteresisCells` (4.8), `heldCells` (4.3)
  - [x] 6.3 `segment.ts`: `restFrames` (4.4 rests), `moveEdges` (4.4 move edges, D13)
  - [x] 6.4 `notate.ts`: moves, lift filter (4.7), grid rounding (4.5)
  - [x] 6.5 Requirement 4.4 rule (b), holds with `dwellTime` 0.35 s and `dwellAngle` 8 degrees (owner answer 1, D17).
        `segment.ts` `holdFrames`, merged into the rests in `notate.ts`. Resolves the sparse Macarena notation (design
        Known limit 3). The count was 16 arm symbols before task 6.7 and is 12 after it.
  - [x] 6.7 First-frame rule (Requirement 4.4 rule b, owner answer 1, D18): `holdFrames(vectors, times, raw,
        speedRests, dwellTime, dwellAngle)` starts a hold only where raw speed is below 5% of the peak of the move before
        it. Example test: `hold-frames.test.ts` (3 tests, pass). The Macarena test call is updated to the new signature.
  - [x] 6.6 Holds move symbol edges on generated scores, on the departure side (design Known limit 4, D19). Owner extension
        of Requirement 4.4 rule b: a hold's last frame must have raw speed below 5% of the peak of the move after it.
        `holdFrames` implements it. Example test: `hold-frames.test.ts` ("ends the hold at frame 25, before the fast start
        of the departure"). The settled-cell example test and P7.5 pass after this change.

- [x] 7. Mirror and tempo (Req 6)
  - [x] 7.1 `mirror.ts`
  - [x] 7.2 Example tests: `mirror.test.ts`

- [ ] 8. Round-trip and invariance properties (Req 7)
  - [x] 8.1 Generators: `genGestureScore` (7.5 domain, D9, D10), `genRandomFrames`, `runOptions` (FC_SEED, D16)
  - [x] 8.2 P7.3 and P7.4 (`mirror.prop.test.ts`) pass at seeds 1, 42, 1234, 99991, 2024 (each one run by
        `$env:FC_SEED` and `vitest run`, after task 6.6), and in the unseeded full run (52 of 52).
  - [x] 8.3 P7.5 (`roundtrip.prop.test.ts`) passes at seeds 1, 42, 1234, 99991, 2024 (after task 6.6), and in the
        unseeded full run (52 of 52).
  - [x] 8.4 P7.6 and P7.7 pass

- [x] 9. Public API
  - [x] 9.1 `index.ts` exports every public function and type, and `WORLD_AXES`

- [x] 10. Requirement 8: real motion capture (`macarena.test.ts`)
  - [x] 10.1 8.1 frame-0 body frame: passes
  - [x] 10.2 8.2: the first symbol of each arm is `forward middle` within 2 beats (left arm at beat 1, right arm at beat
        1.5). Passes with holds and D18. The test also prints the total arm symbols (12 after D18) and the first eight.

  - [x] 10.2 8.2: the first symbol of each arm is `forward middle` within 2 beats (left arm at beat 1, right arm at beat
        1.5). Passes with holds and D19. The test prints 10 arm symbols in total and the first eight.

- [x] 11. Checks
  - [x] 11.1 `pnpm --filter @danse/core typecheck` passes (exit 0)
  - [x] 11.2 `pnpm --filter @danse/core test` passes 52 of 52 tests in 15 files. This includes the settled-cell example
        test in `notate.test.ts`, P7.5, and the 3 tests in `hold-frames.test.ts`. `known-limits.test.ts` has been removed by
        the owner.

- [x] 12. Owner decisions
  - [x] 12.1 Remove `test/known-limits.test.ts` (owner removed it).
  - [x] 12.2 Known limit 3 (sparse notation): answered as Requirement 4.4 rule (b), holds (task 6.5).
  - [x] 12.3 Confirm the 5% move-edge threshold (D13). Owner confirmed.
  - [x] 12.4 Task 6.6, the departure side of a hold. The owner extended Requirement 4.4 rule b with the last-frame rule
        (D19). Implemented in `holdFrames`. The alternative of a smaller `dwellAngle` is not applied. No owner answer on it.
