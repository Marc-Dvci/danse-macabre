# Tasks: fidelity

- [ ] 1. Statistics helpers (Req 1.2)
  - [ ] 1.1 Test `test/fidelity-stats.test.ts`: `mean`, `median`, `percentile` on known lists, including empty lists.
  - [ ] 1.2 `src/fidelity-stats.ts`.
- [ ] 2. Replay measure (Req 1.1 to 1.4)
  - [ ] 2.1 Tests `test/fidelity.prop.test.ts` (F1, F2, F3, F5) and `test/fidelity.test.ts` (F4). Write before the code.
  - [ ] 2.2 `src/fidelity.ts`: `replayFidelity`, limb segments, coordinates in each body frame, leg lift filter on the
        recording.
  - [ ] 2.3 Export from `src/index.ts`.
  - [ ] 2.4 Run `pnpm --filter @danse/core test:props` and `pnpm --filter @danse/core exec vitest run fidelity`. Tick
        when green.
- [ ] 3. Before table (Req 3.1, first half)
  - [ ] 3.1 `scripts/fidelity-report.ts`: nine clips at 100 bpm, grid 0.5, `notate` then `replayFidelity`, one markdown
        table on stdout. Takes `--label`.
  - [ ] 3.2 Run it with the current rules and keep the output as the "before" table.
- [ ] 4. Leg rule change (Req 2.1)
  - [ ] 4.1 Test in `test/notate.test.ts`: a leg move whose rising part is near the floor and whose end is in the air is
        written. Write it first; it fails on the current rule.
  - [ ] 4.2 `src/notate.ts`: the lift filter reads frame `move.end` only.
  - [ ] 4.3 Run the laban-core properties `test/roundtrip.prop.test.ts` and `test/mirror.prop.test.ts` at seeds 1, 42,
        1234, 99991 and 2024, one seed per command (Req 2.2).
- [ ] 5. After table and record (Req 3.1, second half)
  - [ ] 5.1 Run the report again for the "after" table.
  - [ ] 5.2 Write `docs/measure/fidelity.md` with both tables and the commands.
- [ ] 6. Checks
  - [ ] 6.1 `pnpm --filter @danse/core test` and `pnpm -r typecheck`. Record the counts.
