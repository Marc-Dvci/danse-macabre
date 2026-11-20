// The web app's single entry into @danse/core. Every score, lesson line and pose shown comes through here.
import {
  describe,
  findPhrase,
  isDirectionSymbol,
  isTurnSymbol,
  mirrorFrames,
  mirrorScore,
  notate,
  perform,
  replayFidelity,
  type DirectionSymbol,
  type Frame,
  type Score,
  type Symbol as LabanSymbol,
} from "@danse/core";

export type { Frame, Score, LabanSymbol, DirectionSymbol };
export { isDirectionSymbol, isTurnSymbol };

export interface NotateSettings {
  tempo: number;
  beatsPerBar: number;
  grid: number;
}

export const DEFAULT_SETTINGS: NotateSettings = { tempo: 100, beatsPerBar: 4, grid: 0.5 };

export function notateClip(frames: Frame[], title: string, s: NotateSettings = DEFAULT_SETTINGS): Score {
  return notate(frames, { ...s, title });
}

export function performScore(score: Score, fps = 30): Frame[] {
  return perform(score, { fps });
}

export function mirror(score: Score): Score {
  return mirrorScore(score);
}

export function mirrorClip(frames: Frame[]): Frame[] {
  return mirrorFrames(frames);
}

/** Mean angle in degrees between the recording's limbs and the skeleton dancing its score. */
export function fidelityOf(recording: Frame[], score: Score): number | null {
  if (recording.length < 2) return null;
  try {
    return replayFidelity(recording, score, {}).meanDegrees;
  } catch {
    return null;
  }
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
  /** Beat of the line; -1 for the starting position and the tempo line. */
  beat: number;
  label: string;
  text: string;
  symbolIds: string[];
}

/** The spoken lesson from the core: one line per beat on which something starts, every word from a symbol. */
export function describeScore(score: Score): LessonLine[] {
  return describe(score).map((l) => {
    if (l.beat === null) return { beat: -1, label: l.symbolIds[0] === "score" ? "Tempo" : "Start", text: l.text, symbolIds: l.symbolIds };
    const cut = l.text.indexOf(": ");
    return {
      beat: l.beat,
      label: cut > 0 ? l.text.slice(0, cut) : `Count ${l.count}`,
      text: cut > 0 ? l.text.slice(cut + 2) : l.text,
      symbolIds: l.symbolIds,
    };
  });
}

/** Symbols starting within [from, from + length) beats, shifted to start at 0: a phrase to search for. */
export function cutPhrase(score: Score, from: number, length: number, part: "arms" | "all"): Score & { at: number } {
  const keep = (c: string) => (part === "arms" ? c.endsWith("arm") : true);
  const picked = score.symbols.filter((s) => keep(s.column) && s.start >= from && s.start < from + length);
  // The phrase starts at its first symbol, so a match's beat is where that first symbol starts.
  const at = picked.length ? Math.min(...picked.map((s) => s.start)) : from;
  return {
    ...score,
    title: `${score.title}, from beat ${at}`,
    startPosition: {},
    symbols: picked.map((s) => ({ ...s, start: s.start - at })),
    at,
  };
}

export function findInScore(score: Score, phrase: Score, mirrorToo: boolean): Array<{ beat: number; mirrored: boolean }> {
  return findPhrase(score, phrase, { mirror: mirrorToo });
}
