// Staff geometry for ScoreView, in staff units with y up (time runs upward).
import type { Score, LabanSymbol } from "./engine";

export interface Glyph {
  symbolId: string;
  column: string;
  kind: "direction" | "turn";
  x: number;
  y: number;
  w: number;
  h: number;
  polygon: Array<[number, number]>;
  level: "high" | "middle" | "low";
  amount?: string;
  label: string;
}

export interface StaffLayout {
  width: number;
  height: number;
  /** y of beat 0 (the double bar line). */
  origin: number;
  left: number;
  right: number;
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  bars: Array<{ y: number; double?: boolean; label?: string }>;
  counts: Array<{ y: number; label: string }>;
  glyphs: Glyph[];
}

export const BEAT_HEIGHT = 24;
const COL = 16;
const START_HEIGHT = 18;

// Column slots outward from the centre line: 1 support, 2 leg gesture, 3 torso (empty), 4 arm.
const SLOT: Record<string, number> = { support: 0, leg: 1, arm: 3 };

function columnX(column: string): { x: number; side: "left" | "right" } {
  const [side, part] = column.split("-") as ["left" | "right", string];
  const slot = SLOT[part] ?? 0;
  return { x: side === "right" ? slot * COL : -(slot + 1) * COL, side };
}

/** Direction shape in a unit box (x 0..1 inner to outer for the right side, y 0..1 bottom to top). */
function unitShape(direction: string): Array<[number, number]> {
  const third = 1 / 3;
  switch (direction) {
    case "place":
      return [[0, 0], [1, 0], [1, 1], [0, 1]];
    case "right":
      return [[0, 0], [1, 0.5], [0, 1]];
    case "left":
      return [[1, 0], [1, 1], [0, 0.5]];
    case "forward":
      return [[0, 0], [1, 0], [1, 1 - third], [0.5, 1 - third], [0.5, 1], [0, 1]];
    case "backward":
      return [[0, 0], [0.5, 0], [0.5, third], [1, third], [1, 1], [0, 1]];
    case "right-forward":
      return [[0, 0], [1, 0], [1, 1], [0, 1 - third]];
    case "left-forward":
      return [[0, 0], [1, 0], [1, 1 - third], [0, 1]];
    case "right-backward":
      return [[0, third], [1, 0], [1, 1], [0, 1]];
    case "left-backward":
      return [[0, 0], [1, third], [1, 1], [0, 1]];
    default:
      return [[0, 0], [1, 0], [1, 1], [0, 1]];
  }
}

const SIDE_DEPENDENT = new Set(["forward", "backward"]);

function describeSymbol(s: LabanSymbol): string {
  const part = s.column.replace("-", " ").replace("support", "step").replace("leg", "leg").replace("arm", "arm");
  const dir = s.direction === "place" ? "place" : s.direction.replace("-", " ");
  return `${part}: ${dir} ${s.level}, ${s.duration} counts from count ${s.start + 1}`;
}

export function layoutStaff(score: Score): StaffLayout {
  const lastBeat = Math.max(score.beatsPerBar * 2, ...score.symbols.map((s) => s.start + s.duration)) + 1;
  const origin = START_HEIGHT + 6;
  const height = origin + lastBeat * BEAT_HEIGHT + 12;
  const half = 4 * COL + 18;
  const width = half * 2;
  const cx = half;
  const left = cx - 2 * COL;
  const right = cx + 2 * COL;
  const lines = [
    { x1: cx - 2 * COL, y1: 0, x2: cx - 2 * COL, y2: height },
    { x1: cx, y1: 0, x2: cx, y2: height },
    { x1: cx + 2 * COL, y1: 0, x2: cx + 2 * COL, y2: height },
  ];
  const bars: StaffLayout["bars"] = [{ y: origin, double: true, label: "1" }];
  for (let b = score.beatsPerBar, n = 2; b < lastBeat; b += score.beatsPerBar, n++) {
    bars.push({ y: origin + b * BEAT_HEIGHT, label: String(n) });
  }
  const counts: StaffLayout["counts"] = [];
  for (let b = 0; b < lastBeat; b++) counts.push({ y: origin + b * BEAT_HEIGHT, label: String((b % score.beatsPerBar) + 1) });

  const glyphs: Glyph[] = [];
  const place = (id: string, column: string, start: number, dur: number, direction: string, level: Glyph["level"], label: string, yBase: number, hOverride?: number) => {
    const { x: colX, side } = columnX(column);
    const pad = 2;
    const x = cx + colX + pad;
    const w = COL - 2 * pad;
    const y = yBase + start * BEAT_HEIGHT + 1;
    const h = hOverride ?? dur * BEAT_HEIGHT - 2;
    const mirrored = side === "left" && SIDE_DEPENDENT.has(direction);
    const polygon = unitShape(direction).map(([ux, uy]) => {
      const fx = side === "right" ? ux : 1 - ux;
      return [x + (mirrored || side === "right" ? fx : ux) * w, y + uy * h] as [number, number];
    });
    glyphs.push({ symbolId: id, column, kind: "direction", x, y, w, h, polygon, level, label });
  };
  for (const [column, cell] of Object.entries(score.startPosition)) {
    if (cell) place(`start-${column}`, column, 0, 0, cell.direction, cell.level, `start: ${column} ${cell.direction} ${cell.level}`, 3, START_HEIGHT - 4);
  }
  for (const s of score.symbols) place(s.id, s.column, s.start, s.duration, s.direction, s.level, describeSymbol(s), origin);
  return { width, height, origin, left, right, lines, bars, counts, glyphs };
}
