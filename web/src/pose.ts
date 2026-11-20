// Frame helpers for playback: centre a recording on the stage, and sample a clip at any time.
import * as THREE from "three";
import type { Frame } from "./engine";
import { JOINTS, type Pose } from "./stage/skeleton";

/** Move and turn a recording so that its first frame stands at the origin facing +z, like the score skeleton. */
export function centreClip(frames: Frame[]): Frame[] {
  const f0 = frames[0];
  if (!f0) return frames;
  const j = f0.joints;
  const rx = j["right-hip"].x - j["left-hip"].x + (j["right-shoulder"].x - j["left-shoulder"].x);
  const rz = j["right-hip"].z - j["left-hip"].z + (j["right-shoulder"].z - j["left-shoulder"].z);
  // forward = cross(up, right) = (rz, 0, -rx)
  const yaw = Math.atan2(rz, -rx);
  const c = Math.cos(-yaw);
  const s = Math.sin(-yaw);
  const ox = j.pelvis.x;
  const oz = j.pelvis.z;
  return frames.map((f) => {
    const joints = {} as Frame["joints"];
    for (const [name, v] of Object.entries(f.joints) as Array<[keyof Frame["joints"], { x: number; y: number; z: number }]>) {
      const x = v.x - ox;
      const z = v.z - oz;
      joints[name] = { x: c * x + s * z, y: v.y, z: -s * x + c * z };
    }
    return { t: f.t, joints };
  });
}

/** Pose at time `t` seconds, blending the two nearest frames. */
export function sample(frames: Frame[], t: number): Pose | null {
  if (frames.length === 0) return null;
  const dt = frames.length > 1 ? frames[1]!.t - frames[0]!.t : 1 / 30;
  const x = Math.max(0, t - frames[0]!.t) / dt;
  const i = Math.min(Math.floor(x), frames.length - 1);
  const k = Math.min(i + 1, frames.length - 1);
  const w = Math.min(Math.max(x - i, 0), 1);
  const a = frames[i]!.joints;
  const b = frames[k]!.joints;
  const out = {} as Pose;
  for (const name of JOINTS) {
    const p = a[name];
    const q = b[name];
    out[name] = new THREE.Vector3(p.x + (q.x - p.x) * w, p.y + (q.y - p.y) * w, p.z + (q.z - p.z) * w);
  }
  return out;
}

export function lastTime(frames: Frame[]): number {
  return frames.length ? frames[frames.length - 1]!.t : 0;
}
