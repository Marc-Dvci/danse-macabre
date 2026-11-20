# Requirements: lesson-search-layout (spoken lesson, phrase search, staff layout)

## Introduction

Adds three pure modules to `@danse/core`: the spoken lesson (the score read aloud on the count, for blind and
low-vision dancers), phrase search, and the staff layout that the web app and the SVG export draw. No language model
is involved: every word comes from a symbol.

## Requirement 1: spoken lesson

**User story:** As a blind dancer, I want each movement said on its count in plain words, so that I can learn the
dance without seeing it.

1. WHEN `describe(score, options)` is called THE SYSTEM SHALL return `LessonLine[]`, each
   `{ beat, count, bar, text, symbolIds }`, one line per beat at which at least one symbol starts, in time order.
2. THE SYSTEM SHALL number counts from 1 within each bar (`beatsPerBar`), write "and" for half beats ("3 and"), and
   name the bar when it changes ("Bar 2, count 1").
3. THE SYSTEM SHALL word each symbol as: body part, verb, direction, level, duration, for example
   "right arm moves forward, high, over 2 counts"; "step forward on the left foot, knees bent";
   "left leg lifts to the side, low"; "turn a quarter clockwise on the right foot". Place high for an arm reads
   "straight up"; place low reads "down by your side"; a step in place reads "step in place".
4. THE SYSTEM SHALL join symbols that start on the same beat in a fixed order (supports, legs, arms, left before
   right) with "; ".
5. THE SYSTEM SHALL start the lesson with the starting position ("Start standing, arms down by your sides") and the
   tempo and metre ("4 counts per bar, 96 counts per minute").
6. WHEN `parseLesson(lines)` is called THE SYSTEM SHALL recover the symbols (column, start, duration, direction,
   level, turn) from the text alone.

## Requirement 2: phrase search

**User story:** As a teacher, I want to find every place a movement phrase appears, so that I can compare dances.

1. WHEN `findPhrase(score, phrase, options)` is called with a phrase score THE SYSTEM SHALL return every start beat
   where, in each column the phrase uses, the score's symbols from that beat match the phrase's symbols in order,
   direction and level, with the same relative start times within `options.tolerance` beats (default 0.5).
2. WHERE `options.mirror` is true THE SYSTEM SHALL also return matches of the mirrored phrase, flagged `mirrored`.
3. THE SYSTEM SHALL return matches sorted by beat, without overlaps for the same phrase.

## Requirement 3: staff layout

**User story:** As a reader, I want the score drawn like a printed Labanotation staff, so that notators recognise it.

1. WHEN `layoutStaff(score, options)` is called THE SYSTEM SHALL return
   `{ width, height, columns, lines, bars, counts, glyphs }` in staff units, where time runs upward, `beatHeight`
   (default 24) units per beat, and `columnWidth` (default 16) units per column.
2. THE SYSTEM SHALL order columns outward from the centre line: support, leg gesture, (empty torso column), arm, on
   each side, and draw three staff lines (left outer, centre, right outer) enclosing the support and leg columns.
3. THE SYSTEM SHALL return each glyph as `{ symbolId, column, x, y, w, h, polygon, level }`, where `polygon` is the
   direction shape below in staff units (y up), mirrored for the left side where the shape depends on side:
   - place: full rectangle;
   - right: triangle with its base on the inner edge and its apex at the outer middle; left: the mirror;
   - forward: rectangle with a notch removed from the top outer corner (half the width, one third of the height);
     backward: the same notch at the bottom outer corner;
   - diagonals: rectangle whose top (forward diagonals) or bottom (backward diagonals) edge slants by one third of
     the height, the named side being the tall side.
4. THE SYSTEM SHALL return turn glyphs as parallelograms slanted left (counter-clockwise) or right (clockwise), with the
   amount as a label ("1/4", "1/2", "3/4", "1").
5. THE SYSTEM SHALL place the starting position below a double bar line at beat 0, a bar line every `beatsPerBar`
   beats, and a count number at every beat.
6. WHEN `renderStaffSvg(score, options)` is called THE SYSTEM SHALL return a standalone SVG string drawn from
   `layoutStaff`: shapes outlined, high level hatched with lines at 45 degrees rising to the right, middle level a
   centre dot, low level filled; every glyph carries `data-symbol-id`.

## Requirement 4: correctness properties (fast-check, at least 200 runs each)

1. Lesson round trip: `parseLesson(describe(s))` equals the symbols of `s` for any valid generated score.
2. No invented words: every direction, side, body part and count named in `describe(s)` belongs to a symbol listed in
   that line's `symbolIds`.
3. Search finds what it is given: a phrase cut from any generated score is found at its own start beat.
4. Mirror search: the mirror of a phrase cut from a score is found with `mirror: true` and flagged `mirrored`.
5. Layout: every symbol has exactly one glyph; glyph height equals duration × beatHeight; glyphs in one column never
   overlap; left and right glyphs of a mirrored score are reflections of each other about the centre line.
