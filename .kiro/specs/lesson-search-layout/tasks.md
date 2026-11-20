# Tasks: lesson-search-layout

Run from the repository root: `pnpm --filter @danse/core test`, `pnpm --filter @danse/core typecheck`.
Write each property test before the code it checks.

- [x] 1. Test generator for lesson, search and layout: `packages/core/test/lesson-generators.ts`, all six columns,
      half-beat starts, validates with `validateScore`. (Requirements 4.1 to 4.5)
- [x] 2. Word tables and symbol phrases: `src/lesson-words.ts`. (Requirement 1.3, 1.4)
- [x] 3. `describe` (lesson lines, metre and start lines): `src/lesson.ts`, example tests in `test/lesson.test.ts`.
      (Requirements 1.1, 1.2, 1.4, 1.5)
- [x] 4. `parseLesson`: `src/lesson-parse.ts`. Property P1 in `test/lesson.prop.test.ts`, example tests.
      (Requirement 1.6, 4.1)
- [x] 5. Property P2 (no invented words) in `test/lesson.prop.test.ts`. (Requirement 1.3, 4.2)
- [x] 6. Phrase search: `src/search.ts`. Example tests in `test/search.test.ts`. (Requirements 2.1 to 2.3)
- [x] 7. Properties P3 and P4 in `test/search.prop.test.ts`. Narrowed by decision D6. (Requirements 4.3, 4.4)
- [x] 8. Staff shapes: `src/layout-shapes.ts`. Example tests of each shape in `test/layout.test.ts`. (Requirement 3.3)
- [x] 9. Staff layout: `src/layout.ts`. Example tests in `test/layout.test.ts`. (Requirements 3.1, 3.2, 3.5)
- [x] 10. Properties P5 and P6 in `test/layout.prop.test.ts`. (Requirement 4.5)
- [x] 11. SVG renderer: `src/staff-svg.ts`, tests in `test/staff-svg.test.ts`. (Requirement 3.6)
- [x] 12. Exports in `src/index.ts`.
- [x] 13. Examples: `examples/macarena.svg` and `examples/macarena-lesson.txt`, written by
      `packages/core/scripts/write-macarena-examples.ts`. (Task 3 of the user request)
- [x] 14. `pnpm --filter @danse/core test` and `typecheck` pass. Record counts.

Open items, not in the tasks above (see design.md, "Scope limits"): turn symbols (Requirements 1.6 turn part and 3.4),
which need the `supports-and-turns` spec.
