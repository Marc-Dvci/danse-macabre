// Dance clips from the CMU Graphics Lab Motion Capture Database, converted by tools/cmu_import.py.
import type { Frame, JointName } from "@danse/core";
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
}

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
