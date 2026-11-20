// The web app's single entry into @danse/core. Every score, lesson line and pose shown comes through here.
import {
  mirrorFrames,
  mirrorScore,
  notateGestures,
  performGestures,
  type Frame,
  type Score,
  type Symbol as LabanSymbol,
} from "@danse/core";

export type { Frame, Score, LabanSymbol };

export interface NotateSettings {
  tempo: number;
  beatsPerBar: number;
  grid: number;
}

export const DEFAULT_SETTINGS: NotateSettings = { tempo: 100, beatsPerBar: 4, grid: 0.5 };

export function notateClip(frames: Frame[], title: string, s: NotateSettings = DEFAULT_SETTINGS): Score {
  return notateGestures(frames, { ...s, title });
}

export function performScore(score: Score, fps = 30): Frame[] {
  return performGestures(score, { fps });
}

export function mirror(score: Score): Score {
  return mirrorScore(score);
}

export function mirrorClip(frames: Frame[]): Frame[] {
  return mirrorFrames(frames);
}

/** Beats to seconds at the score's tempo. */
export function beatsToSeconds(score: Score, beats: number): number {
  return (beats * 60) / score.tempo;
}

export function secondsToBeats(score: Score, seconds: number): number {
  return (seconds * score.tempo) / 60;
}

/** "Bar 2, count 3 and" for a beat position. */
export function countLabel(score: Score, beat: number): { bar: number; count: number; and: boolean } {
  const b = Math.max(0, beat);
  const bar = Math.floor(b / score.beatsPerBar) + 1;
  const inBar = b - (bar - 1) * score.beatsPerBar;
  return { bar, count: Math.floor(inBar) + 1, and: inBar - Math.floor(inBar) >= 0.5 };
}

export interface LessonLine {
  beat: number;
  label: string;
  text: string;
  symbolIds: string[];
}

const PART: Record<string, string> = {
  "left-arm": "left arm",
  "right-arm": "right arm",
  "left-leg": "left leg",
  "right-leg": "right leg",
  "left-support": "left foot",
  "right-support": "right foot",
};

/** Interim wording, replaced by the core's describe() once that spec is built. */
export function describeScore(score: Score): LessonLine[] {
  const byBeat = new Map<number, LabanSymbol[]>();
  for (const s of score.symbols) byBeat.set(s.start, [...(byBeat.get(s.start) ?? []), s]);
  const lines: LessonLine[] = [
    { beat: -1, label: "Start", text: `${score.beatsPerBar} counts per bar, ${score.tempo} counts per minute.`, symbolIds: [] },
  ];
  for (const beat of [...byBeat.keys()].sort((a, b) => a - b)) {
    const syms = byBeat.get(beat)!;
    const c = countLabel(score, beat);
    const label = `${c.count === 1 && !c.and ? `Bar ${c.bar}, ` : ""}${c.count}${c.and ? " and" : ""}`;
    const text = syms
      .map((s) => {
        const dir = s.direction === "place" ? (s.level === "high" ? "straight up" : s.level === "low" ? "down" : "in place") : s.direction.replace("-", " ");
        const lvl = s.direction === "place" ? "" : `, ${s.level}`;
        return `${PART[s.column] ?? s.column} ${s.column.endsWith("support") ? "steps" : "moves"} ${dir}${lvl}`;
      })
      .join("; ");
    lines.push({ beat, label, text, symbolIds: syms.map((s) => s.id) });
  }
  return lines;
}
