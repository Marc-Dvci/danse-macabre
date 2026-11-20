// Staff geometry for ScoreView, in staff units with y up (time runs upward). The layout itself comes from
// @danse/core's layoutStaff; this file adapts it for the view and keeps the glyph shapes for the legend.
import { layoutStaff as coreLayout } from "@danse/core";
import { isDirectionSymbol, type Score, type LabanSymbol } from "./engine";

export interface Glyph {
  symbolId: string;
  column: string;
  kind: "direction" | "turn";
  x: number;
  y: number;
  w: number;
  h: number;
  polygon: Array<[number, number]>;
  /** Null for a turn glyph, which has no level. */
  level: "high" | "middle" | "low" | null;
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

/** Direction shape in a unit box (x 0..1 inner to outer for the right side, y 0..1 bottom to top). */
export function unitShape(direction: string): Array<[number, number]> {
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


function describeSymbol(s: LabanSymbol): string {
  const part = s.column.replace("-", " ").replace("support", "foot, step");
  if (!isDirectionSymbol(s)) {
    const turn = s as unknown as { rotation: string; amount: number };
    return `${part}: turn ${turn.amount} ${turn.rotation === "cw" ? "clockwise" : "counter-clockwise"}, ${s.duration} counts`;
  }
  const dir = s.direction === "place" ? "place" : s.direction.replace("-", " ");
  return `${part}: ${dir} ${s.level}, ${s.duration} ${s.duration === 1 ? "count" : "counts"}`;
}

/** The score's staff, from the core layout, in the shape ScoreView draws. */
export function layoutStaff(score: Score): StaffLayout {
  const core = coreLayout(score, { beatHeight: BEAT_HEIGHT });
  const bySymbol = new Map(score.symbols.map((s) => [s.id, s]));
  const xs = core.lines.map((l) => l.x);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  return {
    width: core.width,
    height: core.height,
    origin: BEAT_HEIGHT,
    left,
    right,
    lines: core.lines.map((l) => ({ x1: l.x, x2: l.x, y1: l.y1, y2: l.y2 })),
    bars: core.bars.map((b, i) => ({ y: b.y, double: b.double, label: i < core.bars.length - 1 ? String(i + 1) : undefined })),
    counts: core.counts.map((c) => ({ y: c.y, label: c.label })),
    glyphs: core.glyphs.map((g) => {
      const sym = bySymbol.get(g.symbolId);
      const turn = g as unknown as { kind?: string; amount?: number };
      const amountLabel: Record<number, string> = { 0.25: "1/4", 0.5: "1/2", 0.75: "3/4", 1: "1" };
      return {
        symbolId: g.symbolId,
        column: g.column,
        kind: turn.kind === "turn" ? ("turn" as const) : ("direction" as const),
        amount: turn.kind === "turn" && turn.amount !== undefined ? amountLabel[turn.amount] : undefined,
        x: g.x,
        y: g.y,
        w: g.w,
        h: g.h,
        // View only: inset each glyph inside its column so neighbouring symbols do not touch.
        polygon: g.polygon.map((p) => {
          const cx = g.x + g.w / 2;
          const top = g.y + g.h;
          const y = Math.min(Math.max(p.y, g.y + 1.2), top - 1.2);
          return [cx + (p.x - cx) * 0.78, y] as [number, number];
        }),
        level: g.level,
        label: sym ? describeSymbol(sym) : `starting position, ${g.column.replace("-", " ")}`,
      };
    }),
  };
}
