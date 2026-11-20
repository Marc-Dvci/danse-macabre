// Compare a score read from video with the score of the same take read from motion capture.
import { isDirectionSymbol, type Frame, type Score } from "./engine";

const ARMS = ["left-arm", "right-arm"] as const;
const SECTORS = [
  "forward",
  "right-forward",
  "right",
  "right-backward",
  "backward",
  "left-backward",
  "left",
  "left-forward",
];

/** The cell a column holds at `beat`: the last symbol that has ended by then, else the start position. */
export function heldCell(score: Score, column: string, beat: number): string | null {
  let cell = score.startPosition[column as keyof Score["startPosition"]];
  let best = -Infinity;
  for (const s of score.symbols) {
    if (s.column !== column || !isDirectionSymbol(s)) continue;
    const end = s.start + s.duration;
    if (end <= beat + 1e-9 && end > best) {
      best = end;
      cell = { direction: s.direction, level: s.level };
    }
  }
  return cell ? `${cell.direction}/${cell.level}` : null;
}

/** True when two cells are the same or one step apart (neighbouring direction at the same level, or same direction one level apart). */
function near(a: string, b: string): boolean {
  if (a === b) return true;
  const [da, la] = a.split("/");
  const [db, lb] = b.split("/");
  const levels = ["low", "middle", "high"];
  const dl = Math.abs(levels.indexOf(la!) - levels.indexOf(lb!));
  if (da === db) return dl <= 1;
  const ia = SECTORS.indexOf(da!);
  const ib = SECTORS.indexOf(db!);
  if (ia < 0 || ib < 0) return false;
  const ds = Math.min((ia - ib + 8) % 8, (ib - ia + 8) % 8);
  return ds === 1 && dl === 0;
}

/** Wrist height above the shoulder, both sides, per frame: a notation-free signal to line the two takes up. */
function wristSignal(frames: Frame[], fps: number, seconds: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    const t = i / fps;
    const f = frames.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), frames[0]!);
    const j = f.joints;
    out.push(j["left-wrist"].y - j["left-shoulder"].y + (j["right-wrist"].y - j["right-shoulder"].y));
  }
  return out;
}

/** Offset in seconds to add to video times so they match motion-capture times (search within ±maxShift). */
export function alignTakes(video: Frame[], mocap: Frame[], maxShift = 3): number {
  const fps = 10;
  const dur = Math.min(video[video.length - 1]!.t, mocap[mocap.length - 1]!.t);
  const a = wristSignal(video, fps, dur);
  const b = wristSignal(mocap, fps, dur + maxShift);
  const norm = (x: number[]) => {
    const m = x.reduce((s, v) => s + v, 0) / x.length;
    const sd = Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / x.length) || 1;
    return x.map((v) => (v - m) / sd);
  };
  const na = norm(a);
  const nb = norm(b);
  let bestShift = 0;
  let bestScore = -Infinity;
  for (let k = -maxShift * fps; k <= maxShift * fps; k++) {
    let s = 0;
    let n = 0;
    for (let i = 0; i < na.length; i++) {
      const j = i + k;
      if (j < 0 || j >= nb.length) continue;
      s += na[i]! * nb[j]!;
      n++;
    }
    if (n > na.length / 2 && s / n > bestScore) {
      bestScore = s / n;
      bestShift = k / fps;
    }
  }
  return bestShift;
}

export interface Agreement {
  samples: number;
  exact: number;
  near: number;
  offsetSeconds: number;
}

/** Share of grid points where both scores hold the same arm cell (and within one step), after lining the takes up. */
export function armAgreement(video: Score, mocap: Score, offsetSeconds: number, seconds: number): Agreement {
  let samples = 0;
  let exact = 0;
  let close = 0;
  const step = video.grid;
  const beats = (seconds * video.tempo) / 60;
  const shiftBeats = (offsetSeconds * mocap.tempo) / 60;
  for (let b = 0; b <= beats; b += step) {
    for (const col of ARMS) {
      const v = heldCell(video, col, b);
      const m = heldCell(mocap, col, b + shiftBeats);
      if (!v || !m) continue;
      samples++;
      if (v === m) exact++;
      if (near(v, m)) close++;
    }
  }
  return { samples, exact: samples ? exact / samples : 0, near: samples ? close / samples : 0, offsetSeconds };
}
