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

- [x] 6. Gesture notation (Req 4)
  - [x] 6.1 Example tests: `notate.test.ts`. Covers one symbol per settled cell (4.4, the old transit test is replaced),
        a leg move that ends on the floor (4.7), the minHold rule (4.3), and hysteresis (4.8) with a control at 0 degrees
  - [x] 6.2 `held-cells.ts`: `hysteresisCells` (4.8), `heldCells` (4.3)
  - [x] 6.3 `segment.ts`: `restFrames` (4.4 rests), `moveEdges` (4.4 move edges, D13)
  - [x] 6.4 `notate.ts`: moves, lift filter (4.7), grid rounding (4.5)
  - [ ] 6.5 Requirement 4.4 leaves sustained motion without a rest as one move (known limit 3). Owner decision needed.

- [x] 7. Mirror and tempo (Req 6)
  - [x] 7.1 `mirror.ts`
  - [x] 7.2 Example tests: `mirror.test.ts`

- [x] 8. Round-trip and invariance properties (Req 7)
  - [x] 8.1 Generators: `genGestureScore` (7.5 domain, D9, D10), `genRandomFrames`, `runOptions` (FC_SEED, D16)
  - [x] 8.2 P7.3 and P7.4 (`mirror.prop.test.ts`) pass at the default seed and at seeds 1, 42, 1234, 99991, 2024
  - [x] 8.3 P7.5 (`roundtrip.prop.test.ts`) passes at the default seed and at the same five seeds
  - [x] 8.4 P7.6 and P7.7 pass

- [x] 9. Public API
  - [x] 9.1 `index.ts` exports every public function and type, and `WORLD_AXES`

- [ ] 10. Requirement 8: real motion capture (`macarena.test.ts`)
  - [x] 10.1 8.1 frame-0 body frame: passes
  - [ ] 10.2 8.2: the right arm's first symbol is `forward middle` at beat 1.5. The left arm's first symbol is
        `backward low` at beat 1, so the check fails (known limit 3).

- [ ] 11. Checks
  - [x] 11.1 `pnpm --filter @danse/core typecheck` passes
  - [ ] 11.2 `pnpm --filter @danse/core test` fails in 3 of 51 tests: two in `known-limits.test.ts` (pinned to the old
        transit rule, listed for removal) and 8.2 in `macarena.test.ts`.

- [ ] 12. Owner decisions
  - [ ] 12.1 Remove `test/known-limits.test.ts` (it pins the superseded 4.4 rule).
  - [ ] 12.2 Decide known limit 3: keep 8.2 as written and accept sparse notation on the Macarena, or change 4.4 (for
        example, a rest after a hold within a cell). No change was made without a decision.
  - [ ] 12.3 Confirm the 5% move-edge threshold (D13).
