# Tasks: supports-and-turns

Dependency order. Tick `- [x]` when the task's tests pass. Requirement numbers are in `requirements.md`. Counts from
the last run of `pnpm --filter @danse/core test` are in the session report.

- [x] 1. Types and guards (Req 2, D20). `types.ts` union; `symbol.ts` with `isTurnSymbol`, `isDirectionSymbol`.
  Callers that read `direction` are narrowed (`mirror.ts`, `score.ts`, `layout.ts`, `lesson.ts`, `lesson-words.ts`,
  `perform.ts`, `search.ts`, and the test files listed in the session report). Typecheck passes.
- [x] 2. Validation, canonical form, mirror for turns. `test/supports.test.ts`, `test/supports-mirror.prop.test.ts`
  (P8.6, involution with turns).
- [x] 3. Contact detection (Glossary). `contact.ts`. `test/supports.test.ts`.
- [x] 4. Support axes (`support-axes.ts`). `test/supports.test.ts`.
- [x] 5. Playback body state and `perform` (Req 3). `perform-body.ts`, `perform.ts`, `track.ts`. Example tests in
  `test/supports.test.ts`: a step moves the pelvis 0.4 m and keeps the other foot planted; a quarter turn turns the body.
- [x] 6. `notateSupports` (Req 1, 2). Example tests in `test/supports.test.ts`: one step, one turn (180° ccw), and a
  quarter turn at 60 and 61 bpm (D30).
- [ ] 7. `notate` combining gestures and supports, leg filter (Req 1.5). Covered by P8.5 and P8.7 in
  `test/supports-validate.prop.test.ts`, which pass. No separate example test.
- [ ] 8. Property tests P8.1 to P8.4. Not all pass. See design D31 (level round trip) and D32 (step direction in
  turned states). P8.5, P8.6 and P8.7 pass.
- [x] 9. Real data: `test/clips-supports.test.ts` notates `russian-dance.json` and `salsa.json` at 100 bpm and prints
  the counts and the first six support symbols. The test asserts validity only.
- [x] 10. `index.ts` exports: `notate`, `perform`, `notateSupports`, `TurnSymbol`, `DirectionSymbol`, `isTurnSymbol`,
  `isDirectionSymbol`, `directionSymbols`.
- [x] 11. Typecheck and tests run; counts are in the session report.
