# Design: lesson-search-layout

Implements `requirements.md` in `packages/core/src`. Everything is pure: no DOM, no Node APIs, no runtime dependencies.
Public API is exported from `src/index.ts` only. Conventions: `.kiro/steering/notation.md`.

## Scope limits in this design

- **Turns are not implemented.** The current `Symbol` type (`types.ts`) has no turn field. The turn symbol belongs to
  `supports-and-turns`, which is not built. `parseLesson` therefore returns `turn: null` for every symbol, `describe`
  says nothing about turns, and `layoutStaff` draws no turn glyphs. Requirements 1.6 (turn part) and 3.4 stay open.
- **Half-beat starts.** The lesson writes "and" for half beats only. `describe` throws a `RangeError` when a symbol
  starts off the half-beat grid. Durations may be any positive multiple of the grid.
- **Support steps** are written by `describe` and `layoutStaff` from `Symbol` data. The notator for supports is not
  part of this spec.

## Modules

| File | Contents | Requirements |
|---|---|---|
| `lesson-words.ts` | `DIRECTION_WORDS`, `LEVEL_WORDS`, `SUPPORT_LEVEL_WORDS`, `LESSON_COLUMN_ORDER`, `symbolPhrase(symbol)`, `startPhrase(column, cell)`, `bodyPart(column)` | 1.3 |
| `lesson.ts` | `LessonLine`, `describe(score)` | 1.1, 1.2, 1.4, 1.5 |
| `lesson-parse.ts` | `LessonSymbol`, `parseLesson(lines)` | 1.6 |
| `search.ts` | `PhraseMatch`, `FindPhraseOptions`, `findPhrase(score, phrase, options?)` | 2.1, 2.2, 2.3 |
| `layout.ts` | `StaffOptions`, `StaffLayout`, `StaffGlyph`, `layoutStaff(score, options?)` | 3.1, 3.2, 3.5 |
| `layout-shapes.ts` | `glyphPolygon(direction, side, box, cx)`, `turn glyphs: none` | 3.3 |
| `staff-svg.ts` | `renderStaffSvg(score, options?)` | 3.6 |

Tests: `packages/core/test/lesson.test.ts`, `lesson.prop.test.ts`, `search.test.ts`, `search.prop.test.ts`,
`layout.test.ts`, `layout.prop.test.ts`, `staff-svg.test.ts`. The score generator for these tests is
`test/lesson-generators.ts` (no `.test.` in the name). It covers all six columns, including support steps.

## Word tables (lesson-words.ts)

| Direction | Words |
|---|---|
| `forward` | `forward` |
| `backward` | `backward` |
| `left` | `to your left` |
| `right` | `to your right` |
| `left-forward` | `forward and to your left` |
| `right-forward` | `forward and to your right` |
| `left-backward` | `backward and to your left` |
| `right-backward` | `backward and to your right` |

Gesture symbols (arm, leg):
- `place high`: `<part> moves straight up`, for both arms and legs.
- `place low`: arm `<part> moves down by your side`; leg `<part> moves straight down`.
- Any other cell: `<part> moves <direction words>, <level>` for arms and `<part> lifts <direction words>, <level>` for
  legs. Level words: `high`, `middle`, `low`.

Support symbols: `step in place on the <side> foot, <level words>` for `place`, and
`step <direction words> on the <side> foot, <level words>` otherwise. Support level words: low `knees bent`, middle
`standing normally`, high `on the balls of your feet`.

Every symbol phrase has `, over <duration> count` appended (`counts` unless the duration is exactly 1).

## Lesson text (lesson.ts, lesson-parse.ts)

Output of `describe(score)` is `LessonLine[]`, in this order:

1. Start line: `beat: null, count: null, bar: null, symbolIds: ['start:<column>', ...]`. Text begins `Start standing`.
   If both arms are `place low`, the text reads `Start standing, arms down by your sides.`. Other start cells follow
   as `<startPhrase>` clauses. A score with no start position reads `Start standing.`.
2. Metre line: `beat: null, ..., symbolIds: ['score']`. Text `<beatsPerBar> counts per bar, <tempo> counts per minute.`
3. One line per start beat, in time order. `beat` is the start in beats, `count` the count within the bar (1-based),
   `bar` the 1-based bar. `symbolIds` lists the symbols that start on that beat, in fixed order: left-support,
   right-support, left-leg, right-leg, left-arm, right-arm (column ties broken by id). Text:
   - `Bar <n>, count <c>: ` when the bar differs from the previous beat line, otherwise `Count <c>: `.
   - `<c>` is the integer count, followed by ` and` for a half beat.
   - Phrases joined with `; `, ending with `.`.

`parseLesson(lines)` reads text only. It skips lines that match neither beat-line form. It reads
`<n> counts per bar` from the metre line, tracks the bar from `Bar <n>` prefixes, and returns symbols in text order:
`{ column, start, duration, direction, level, turn: null }`. It throws `Error` when the metre line is missing, when
a beat line appears before any bar is named, or when a phrase does not match a known form.

## Phrase search (search.ts)

Inputs: `score`, `phrase` (a `Score`, only `symbols` are used), `options.tolerance` (default 0.5 beats),
`options.mirror` (default false).

Algorithm, for one phrase P:

1. If P has no symbols, return `[]`.
2. Let `r(s) = s.start - min(start over P)`, the relative start. Let `c0` be the column of the earliest phrase symbol
   (ties: first in `COLUMN_ORDER`). Candidate beats are the distinct starts of score symbols in `c0`.
3. Candidate `b` matches when, for every column `c` used by P, the score symbols of column `c` with `start >= b - 1e-9`,
   sorted by start, begin with `P_c.length` symbols that satisfy, index by index: same `direction`, same `level`, and
   `|(S.start - b) - r(P_c[k])| <= tolerance`. Extra score symbols after those are ignored.
4. Matches of P have `mirrored: false`. With `options.mirror`, P is mirrored with `mirrorScore`, and its matches are
   returned with `mirrored: true`.
5. Overlaps: within each kind (original and mirrored), a match is dropped when it starts before the previous kept match
   of that kind ends (`previous.beat + extent`), where `extent = max(start + duration) - min(start)` over P.
   Original matches are checked before mirrored ones at the same beat.
6. Return matches sorted by beat, then `mirrored` (false first).

Durations are not compared (requirement 2.1 names direction, level and relative start only).

## Staff layout (layout.ts, layout-shapes.ts, staff-svg.ts)

Coordinates are staff units with y up, starting at 0 at the bottom of the staff. Options: `beatHeight` (default 24),
`columnWidth` (default 16).

- `y(beat) = (beat + 1) * beatHeight`. The start-position zone is beat -1 to beat 0, so it occupies `[0, beatHeight]`.
- Total beats: `E = max(start + duration)` over symbols, rounded up to a whole bar (`beatsPerBar`), at least one bar.
- Height: `(E + 1) * beatHeight`.
- Columns, left to right: `left-arm`, `left-torso`, `left-leg`, `left-support`, centre line at `x = 4w`,
  `right-support`, `right-leg`, `right-torso`, `right-arm`. Each column has width `w = columnWidth`, and the left
  column at index `i` starts at `i * w`. Width = `8w`. The torso columns have no glyphs.
- Staff lines: left outer at `x = 2w`, centre at `4w`, right outer at `6w`, each from `y(0) - beatHeight`... from
  `y = 0` to the top.
- Bars: a bar line at every `k * beatsPerBar`, `k >= 0`, up to `E`. Beat 0 has a double bar line (two lines a few
  units apart). The start zone sits below it.
- Counts: one label for each integer beat in `[0, E)`. Label is `(beat mod beatsPerBar) + 1` as text at `y(beat)`.
- Glyphs: each symbol gives one glyph: `x` = column x, `w = columnWidth`, `y = y(start)`, `h = duration * beatHeight`.
  Each start cell gives one glyph with `symbolId: 'start:<column>'`, height `beatHeight`, at `y = 0`.
- `polygon` is absolute in staff units.

Shapes (`layout-shapes.ts`). The right-side shape for box `[x0, x1] × [y0, y1]` (`x0` nearest the centre line, `w`
width, `h` height, `mid = (y0+y1)/2`):
- `place`: full rectangle.
- `right`: triangle `(x0,y0), (x0,y1), (x1,mid)`. `left`: triangle `(x1,y0), (x1,y1), (x0,mid)`.
- `forward`: rectangle with the top outer corner removed: outer edge `x1`, notch of width `w/2` and height `h/3`.
- `backward`: same notch at the bottom outer corner.
- `right-forward`: right edge tall, top edge slanting down to the left by `h/3`.
- `left-forward`: left edge tall, top edge slanting down to the right by `h/3`.
- `right-backward`, `left-backward`: as the forward pair, with the bottom edge slanting.

Left-side glyphs use `leftShape(d, box) = reflect(rightShape(swap(d), mirrorBox(box)))`, where `reflect` maps
`x -> 2*cx - x` and `mirrorBox` reflects a box about the centre line. A mirrored score therefore gives reflected glyphs.

SVG (`renderStaffSvg`): `<svg>` with `viewBox` from `layoutStaff`; y is flipped (`svgY = height - y`). Shapes have an
outline. Level: `high` is hatched with a pattern of 45-degree lines rising to the right, `middle` is white with a centre
dot, `low` is solid. Each glyph is a `<g data-symbol-id="...">`. Text is XML-escaped.

## Correctness properties (fast-check, at least 200 runs each)

| # | Property | Requirement | Test file |
|---|---|---|---|
| P1 | `parseLesson(describe(s))` equals the symbols of `s` (column, start, duration, direction, level; turn null), sorted by start then column | 4.1 | `lesson.prop.test.ts` |
| P2 | Every direction, side, body part, count and level word in each line belongs to the symbols in that line's `symbolIds` (start lines: to `startPosition`; metre line: to the score) | 4.2 | `lesson.prop.test.ts` |
| P3 | A phrase cut from a generated score (all symbols with start in `[b, b+L)`, shifted by `-b`) is found at `b` | 4.3 | `search.prop.test.ts` |
| P4 | `mirrorScore(cut)` is found at `b` with `mirrored: true` when searched with `mirror: true` | 4.4 | `search.prop.test.ts` |
| P5 | Each symbol has exactly one glyph; `h = duration * beatHeight`; glyphs in one column do not overlap | 4.5 | `layout.prop.test.ts` |
| P6 | For a score `s` and `mirrorScore(s)`, every glyph is the reflection about the centre line of its mirror glyph | 4.5 | `layout.prop.test.ts` |

## Decisions

- D1. `turn` is always `null` until `supports-and-turns` adds a turn field. Requirement 1.6 and 3.4 are open.
- D2. The start position is described by lines whose `symbolIds` use `start:<column>`. Requirement 4.2 is checked
  against `startPosition` for those lines.
- D3. The `options` argument of `describe` has no fields in v1. The function takes `(score)`.
- D4. Words: `to your left` and `to your right`, not `to the side`. The side must be unambiguous for a blind learner.
- D5. Phrase matching: a prefix per column, with tolerance on relative start only. Durations are not compared.
- D6. Conflict between Requirement 2.3 and Requirement 4.3. A phrase that repeats itself has two overlapping
  occurrences. Requirement 2.3 keeps only the earlier one. Requirement 4.3 says a cut is found at its own beat. The
  code follows 2.3. P3 and P4 accept the cut's beat when it is either reported, or lies inside an earlier kept match
  of the same phrase. Counterexample (found by fast-check, shrunk): score with `right-support` symbols at beats 0, 0.5
  and 1, all `place high`, duration 0.5. Cut from beat 0.5 of length 0.5000000010000003 is the phrase
  `[place high at 0, place high at 0.5]`. Its matches are beat 0 only. The owner should decide which requirement
  holds. Example test: `search.test.ts`, "keeps the earlier of two overlapping occurrences".
