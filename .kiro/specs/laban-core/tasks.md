# Tasks: laban-core

Order follows the dependency graph in `design.md`. Ticks mark tasks whose tests pass. Tasks with a failing property or
a failing requirement test stay unticked.

- [x] 1. Types and vector helpers (Req 1.1, 2, 3.1)
  - [x] 1.1 `types.ts` (Vec3 comment now states right = −x), `vec.ts`
  - [x] 1.2 Example tests: `vec.test.ts` (add, sub, scale, dot, cross, length, normalize, angleDeg)

- [x] 2. Score validation and canonical form (Req 1.2–1.4)
  - [x] 2.1 Example tests: `validate.test.ts`
  - [x] 2.2 `score.ts`: `validateScore`, `canonicalScore`, `COLUMN_ORDER`
  - [x] 2.3 Example test: `canonical.test.ts`

- [x] 3. Body frame (Req 2)
  - [x] 3.1 Example tests: `body-frame.test.ts` (right = −x for a dancer facing +z, forward = cross(up, right), reuse
        of previous axes under 1 cm)
  - [x] 3.2 `body-frame.ts` (fixed: forward = cross(up, right); WORLD_AXES right = −x)
  - [ ] 3.3 Requirement 2.2 text still says "+x right, +z forward". The code uses right = −x, which 2.1 requires. The
        owner must correct 2.2 (see report).

- [x] 4. Quantisation (Req 3)
  - [x] 4.1 `generators.ts`: `arbNonZeroVector`, `arbYaw`, `arbAxes`
  - [x] 4.2 Property tests: `quantize.prop.test.ts` (P7.1, P7.2)
  - [x] 4.3 `quantize.ts`
  - [x] 4.4 Example tests: `quantize.test.ts` (updated for right = −x)

- [x] 5. Rig, interpolation and playback (Req 5)
  - [x] 5.1 `rig.ts` (right side at −x), `interpolate.ts`
  - [x] 5.2 Example tests: `perform.test.ts` (updated for right = −x)
  - [x] 5.3 `perform.ts`

- [x] 6. Gesture notation (Req 4, rules of the owner's answers)
  - [x] 6.1 Example tests: `notate.test.ts`. Covers the transit symbol (known limit 1), a leg move that ends on the
        floor (no `place low` symbol), and the `minHold` rule (a one-frame blip is ignored, a 0.5 s hold is written)
  - [x] 6.2 `notate.ts`: cell runs with minHold (4.3), smoothed speed minima (4.4), leg lift test (4.7), grid
        rounding (4.5). The 60 deg/s rule and `REST_SPEED` are removed.

- [x] 7. Mirror and tempo (Req 6)
  - [x] 7.1 `mirror.ts`
  - [x] 7.2 Example tests: `mirror.test.ts`

- [x] 8. Round-trip and invariance properties (Req 7)
  - [x] 8.1 Generators: `genGestureScore` (7.5 domain, D9, D10), `genRandomFrames`
  - [ ] 8.2 P7.3 (`mirror.prop.test.ts`) passes. P7.4 fails intermittently (known limit 2). P7.6 and P7.7 pass.
  - [ ] 8.3 P7.5 (`roundtrip.prop.test.ts`) fails (known limit 1). The P7.5d diagnostic was removed.

- [x] 9. Public API
  - [x] 9.1 `index.ts` exports every public function and type, and `WORLD_AXES`

- [ ] 10. Requirement 8: real motion capture (`macarena.test.ts`)
  - [x] 10.1 8.1 frame-0 body frame: `macarena.test.ts`
  - [ ] 10.2 8.2 notation at 100 bpm: runs and the first eight symbols are logged. The expected order does not hold
        (see report).

- [ ] 11. Checks
  - [x] 11.1 `pnpm --filter @danse/core typecheck` passes
  - [ ] 11.2 `pnpm --filter @danse/core test` fails in 2 tests (P7.5, Req 8.2). P7.4 failed in earlier runs.
