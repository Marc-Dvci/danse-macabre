---
inclusion: fileMatch
fileMatchPattern: ["packages/core/**", "packages/mcp/**", ".kiro/specs/**"]
---

# Labanotation subset used by Danse Macabre

Source of the conventions: Ann Hutchinson Guest, *Labanotation* (4th ed.), and the Dance Notation Bureau's
teaching material. This project implements a documented subset; everything outside it is out of scope.

## Staff

- Read from bottom to top. Time runs upward; a symbol's vertical length is its duration.
- A centre line splits the body: left side columns to the left, right side columns to the right.
- Columns used, outward from the centre line on each side: 1 support, 2 leg gesture, 3 (unused in v1: torso),
  4 arm. Column ids: `left-support`, `right-support`, `left-leg`, `right-leg`, `left-arm`, `right-arm`.
- The starting position is written below a double bar line. Bar lines mark measures; counts are numbered on the left.

## Direction and level

- Nine directions: `place`, `forward`, `backward`, `left`, `right`, `left-forward`, `right-forward`,
  `left-backward`, `right-backward`.
- Three levels: `high`, `middle`, `low`. Shading in the glyph: high = diagonal strokes, middle = a dot, low = solid.
- In a **gesture** column (arm, leg gesture) a symbol gives the direction of the limb's free end from its base
  (shoulder for the arm, hip for the leg) and its level (above, level with, or below the base). `place high` is
  straight up, `place low` is straight down. `place middle` is not a gesture direction.
- In a **support** column a symbol is a step: the direction of travel of the centre of weight onto that foot, and the
  level of the support (low = knees bent, middle = normal standing, high = on the balls of the feet). `place` means
  stepping in place.
- A blank in a column means "no change": a gesture keeps its last position, the weight stays where it is.
- Directions are relative to the dancer's front (Standard Cross of Axes: up is the line of gravity, front turns with
  the dancer's facing).

## Turns

- A turn sign in a support column turns the body on that foot. Clockwise or counter-clockwise (seen from above),
  amount in quarters: 1/4, 1/2, 3/4, 1.

## Mirror

- Mirroring a score swaps every left column with its right column, swaps `left` with `right` in every direction name,
  keeps forward and backward, keeps levels and timing, and swaps clockwise with counter-clockwise turns.
