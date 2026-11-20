// Dance clips from the CMU Graphics Lab Motion Capture Database, converted by tools/cmu_import.py.
import type { Frame, JointName, Score } from "@danse/core";
import manifest from "../../data/clips/index.json";

export interface ClipInfo {
  id: string;
  title: string;
  seconds: number;
  subject: string;
  trial: string;
  description: string;
}

export interface Clip extends ClipInfo {
  fps: number;
  joints: JointName[];
  raw: number[][][];
  frames: Frame[];
  /** A dance that exists only as a written score (no recording), with optional music. */
  score?: Score;
  music?: { src: string; offset: number; credit: string };
}

/** Score-only dances shown at the top of the list. */
export const FEATURED: ClipInfo[] = [
  {
    id: "finale",
    title: "Danse macabre",
    seconds: 40,
    subject: "score",
    trial: "",
    description: "A waltz written as a score, danced by a ring of skeletons to Saint-Saëns (1874), Fourestier recording (1953, public domain)",
  },
];

// The finale was choreographed by Kiro through the MCP server's compose_score tool (examples/compose-finale.mjs).
const scoreLoaders = import.meta.glob<Score>("../../examples/danse-macabre.score.json", { import: "default" });

export const CLIP_SOURCE: string = manifest.source;
export const CLIPS: ClipInfo[] = manifest.clips;

const loaders = import.meta.glob<{ fps: number; joints: JointName[]; frames: number[][][] }>(
  "../../data/clips/*.json",
  { import: "default" },
);

const cache = new Map<string, Promise<Clip>>();

export function loadClip(id: string): Promise<Clip> {
  const hit = cache.get(id);
  if (hit) return hit;
  if (id === "finale") {
    const load = scoreLoaders["../../examples/danse-macabre.score.json"]!;
    const p = load().then((score) => ({
      ...FEATURED[0]!,
      fps: 30,
      joints: [] as JointName[],
      raw: [],
      frames: [] as Frame[],
      score,
      music: {
        src: `${import.meta.env.BASE_URL}audio/danse-macabre-fourestier-1953.opus`,
        offset: 1.24,
        credit: "Saint-Saëns, Danse macabre (1874). Orchestre des Concerts Colonne, Louis Fourestier, 1953. Public domain, via the BnF and Wikimedia Commons.",
      },
    }));
    cache.set(id, p);
    return p;
  }
  const info = CLIPS.find((c) => c.id === id);
  const load = loaders[`../../data/clips/${id}.json`];
  if (!info || !load) return Promise.reject(new Error(`Unknown clip ${id}`));
  const p = load().then((data) => {
    const frames: Frame[] = data.frames.map((row, i) => {
      const joints = {} as Frame["joints"];
      data.joints.forEach((name, k) => {
        const v = row[k] ?? [0, 0, 0];
        joints[name] = { x: v[0] ?? 0, y: v[1] ?? 0, z: v[2] ?? 0 };
      });
      return { t: i / data.fps, joints };
    });
    return { ...info, fps: data.fps, joints: data.joints, raw: data.frames, frames };
  });
  cache.set(id, p);
  return p;
}

/** Dances read from a video in this session. They live in memory only. */
const custom = new Map<string, Clip>();
const listeners = new Set<() => void>();

export function addCustomClip(info: ClipInfo, frames: Frame[]): void {
  const fps = frames.length > 1 ? 1 / (frames[1]!.t - frames[0]!.t) : 30;
  custom.set(info.id, { ...info, fps, joints: [], raw: [], frames });
  cache.set(info.id, Promise.resolve(custom.get(info.id)!));
  for (const l of listeners) l();
}

export function customClips(): ClipInfo[] {
  return [...custom.values()];
}

export function onCustomClips(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
