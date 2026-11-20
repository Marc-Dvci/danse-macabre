import type { Direction } from './types';

export type Point = { x: number; y: number };

/** An axis-aligned box in staff units. `x0` is the edge nearest the centre line on the right side. */
export type Box = { x0: number; x1: number; y0: number; y1: number };

/** Replaces `left` with `right` and the reverse inside a direction name. */
function swapSide(direction: Direction): Direction {
  return direction.replace(/left|right/g, (m) => (m === 'left' ? 'right' : 'left')) as Direction;
}

/**
 * Outline of a glyph on the right side of the centre line (Requirement 3.3). The shape of a direction on the left side is
 * this shape mirrored, so `glyphPolygon` works from this function.
 */
function rightShape(direction: Direction, box: Box): Point[] {
  const { x0, x1, y0, y1 } = box;
  const w = x1 - x0;
  const h = y1 - y0;
  const mid = (y0 + y1) / 2;
  const p = (x: number, y: number): Point => ({ x, y });
  switch (direction) {
    case 'place':
      return [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];
    case 'right':
      return [p(x0, y0), p(x0, y1), p(x1, mid)];
    case 'left':
      return [p(x1, y0), p(x1, y1), p(x0, mid)];
    case 'forward':
      return [p(x0, y0), p(x1, y0), p(x1, y1 - h / 3), p(x1 - w / 2, y1 - h / 3), p(x1 - w / 2, y1), p(x0, y1)];
    case 'backward':
      return [p(x0, y0), p(x1 - w / 2, y0), p(x1 - w / 2, y0 + h / 3), p(x1, y0 + h / 3), p(x1, y1), p(x0, y1)];
    case 'right-forward':
      return [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1 - h / 3)];
    case 'left-forward':
      return [p(x0, y0), p(x1, y0), p(x1, y1 - h / 3), p(x0, y1)];
    case 'right-backward':
      return [p(x0, y0 + h / 3), p(x1, y0), p(x1, y1), p(x0, y1)];
    case 'left-backward':
      return [p(x0, y0), p(x1, y0 + h / 3), p(x1, y1), p(x0, y1)];
  }
}

/**
 * Outline of a symbol's glyph in staff units, y up. Right-side glyphs use the shape of their direction. Left-side glyphs
 * use the mirror of the shape of the swapped direction, so a mirrored score gives reflected glyphs.
 * @param direction Direction of the symbol.
 * @param side `right` or `left`, the side of the centre line the column is on.
 * @param box Position of the glyph in staff units.
 * @param centreX x of the centre line.
 * @returns Polygon vertices in order.
 */
export function glyphPolygon(direction: Direction, side: 'left' | 'right', box: Box, centreX: number): Point[] {
  if (side === 'right') return rightShape(direction, box);
  const mirrored: Box = { x0: 2 * centreX - box.x1, x1: 2 * centreX - box.x0, y0: box.y0, y1: box.y1 };
  return rightShape(swapSide(direction), mirrored).map((q) => ({ x: 2 * centreX - q.x, y: q.y }));
}

/** Horizontal slant of a turn parallelogram, as a fraction of the column width. */
const TURN_SLANT = 0.25;

/**
 * Outline of a turn glyph on the right side (Requirement 3.4). A counter-clockwise turn is a parallelogram whose top edge
 * is shifted left, and a clockwise turn one whose top edge is shifted right. Both edges keep their length.
 */
function rightTurnShape(rotation: 'cw' | 'ccw', box: Box): Point[] {
  const { x0, x1, y0, y1 } = box;
  const s = (x1 - x0) * TURN_SLANT;
  const p = (x: number, y: number): Point => ({ x, y });
  if (rotation === 'ccw') return [p(x0 + s, y0), p(x1, y0), p(x1 - s, y1), p(x0, y1)];
  return [p(x0, y0), p(x1 - s, y0), p(x1, y1), p(x0 + s, y1)];
}

/**
 * Outline of a turn glyph in staff units, y up. The slant depends only on the rotation, so a counter-clockwise turn
 * slants left on either side. Left-side glyphs are built like direction glyphs: the mirror of the swapped rotation on the
 * right side, reflected back, so a mirrored score gives reflected glyphs.
 * @param rotation `cw` or `ccw`, seen from above.
 * @param side `right` or `left`, the side of the centre line the column is on.
 * @param box Position of the glyph in staff units.
 * @param centreX x of the centre line.
 * @returns Polygon vertices in order.
 */
export function turnPolygon(rotation: 'cw' | 'ccw', side: 'left' | 'right', box: Box, centreX: number): Point[] {
  if (side === 'right') return rightTurnShape(rotation, box);
  const mirrored: Box = { x0: 2 * centreX - box.x1, x1: 2 * centreX - box.x0, y0: box.y0, y1: box.y1 };
  const swapped = rotation === 'cw' ? 'ccw' : 'cw';
  return rightTurnShape(swapped, mirrored).map((q) => ({ x: 2 * centreX - q.x, y: q.y }));
}
