import { smoothstep } from './interpolate';
import { PELVIS } from './rig';
import { bodyAxesFromYaw, horizontalVector, PLAY_LEVEL_PELVIS } from './support-axes';
import { isTurnSymbol } from './symbol';
import type { BodyAxes, DirectionSymbol, Score, Vec3 } from './types';
import { scale } from './vec';

export type Foot = 'left' | 'right';

/** Horizontal position in metres. */
export type XZ = { x: number; z: number };

/** Linear interpolation of two horizontal positions, `u` in [0, 1]. */
function interpolateXZ(a: XZ, b: XZ, u: number): XZ {
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u };
}

/** Height of the stepping foot above the floor at the top of its lift, in metres (supports-and-turns D27). */
export const LIFT_HEIGHT = 0.2;
/** Fraction of a step over which the foot rises and falls. The contact limit is crossed 3% into a step (D27). */
export const LIFT_RAMP = 0.05;

/** A planned step: the foot leaves at `t0`, lands at `t1`, and the pelvis moves from `pelvis0` to `pelvis1`. */
export type StepPlan = {
  foot: Foot;
  t0: number;
  t1: number;
  pelvis0: XZ;
  pelvis1: XZ;
  h0: number;
  h1: number;
  anchor0: XZ;
  anchor1: XZ;
};

/** A planned turn. `yaw0` and `yaw1` are the cumulative body yaw in degrees before and after it. */
export type TurnPlan = { t0: number; t1: number; yaw0: number; yaw1: number };

export type BodyPlan = {
  steps: StepPlan[];
  turns: TurnPlan[];
  /** Foot positions before the first step. */
  initialAnchors: Record<Foot, XZ>;
};

/** Hip offset of a foot from the pelvis, in the body axes: the left hip is at −right, the right hip at +right. */
export function hipXZ(foot: Foot, pelvis: XZ, axes: BodyAxes, hipHalfWidth: number): XZ {
  const sign = foot === 'left' ? -1 : 1;
  return {
    x: pelvis.x + sign * axes.right.x * hipHalfWidth,
    z: pelvis.z + sign * axes.right.z * hipHalfWidth,
  };
}

/** Cumulative yaw in degrees at time t, from the planned turns. */
export function yawAt(turns: TurnPlan[], t: number): number {
  let yaw = 0;
  for (const tr of turns) {
    if (t >= tr.t1) {
      yaw = tr.yaw1;
    } else if (t > tr.t0) {
      return tr.yaw0 + (tr.yaw1 - tr.yaw0) * smoothstep((t - tr.t0) / (tr.t1 - tr.t0));
    } else {
      return yaw;
    }
  }
  return yaw;
}

/**
 * Plans the steps and turns of a score in time order (supports-and-turns Requirement 3). Each step's pelvis travel and
 * landing spot use the body axes at its start and end, so a step after a turn goes in the new facing.
 * @param score A score. Only support columns are read.
 * @param stepLength Pelvis travel of one step, in metres.
 * @param beatSeconds Seconds per beat.
 */
export function planBody(score: Score, stepLength: number, beatSeconds: number, hipHalfWidth: number): BodyPlan {
  const support = score.symbols.filter((s) => s.column === 'left-support' || s.column === 'right-support');

  const turns: TurnPlan[] = [];
  let base = 0;
  for (const s of support.filter(isTurnSymbol).sort((a, b) => a.start - b.start)) {
    const delta = (s.rotation === 'cw' ? -1 : 1) * s.amount * 360;
    turns.push({ t0: s.start * beatSeconds, t1: (s.start + s.duration) * beatSeconds, yaw0: base, yaw1: base + delta });
    base += delta;
  }

  const origin: XZ = { x: PELVIS.x, z: PELVIS.z };
  const initialAxes = bodyAxesFromYaw(0);
  const initialAnchors: Record<Foot, XZ> = {
    left: hipXZ('left', origin, initialAxes, hipHalfWidth),
    right: hipXZ('right', origin, initialAxes, hipHalfWidth),
  };
  const anchors: Record<Foot, XZ> = { ...initialAnchors };

  const steps: StepPlan[] = [];
  let pelvis: XZ = origin;
  let height = PELVIS.y;
  const directionSteps = support
    .filter((s): s is DirectionSymbol => !isTurnSymbol(s))
    .sort((a, b) => a.start - b.start);
  for (const s of directionSteps) {
    const foot: Foot = s.column === 'left-support' ? 'left' : 'right';
    const t0 = s.start * beatSeconds;
    const t1 = (s.start + s.duration) * beatSeconds;
    const axes0 = bodyAxesFromYaw(yawAt(turns, t0));
    const step = scale(horizontalVector(s.direction, axes0), stepLength);
    const pelvis1: XZ = { x: pelvis.x + step.x, z: pelvis.z + step.z };
    const axes1 = bodyAxesFromYaw(yawAt(turns, t1));
    const h1 = PLAY_LEVEL_PELVIS[s.level];
    const anchor1 = hipXZ(foot, pelvis1, axes1, hipHalfWidth);
    steps.push({
      foot,
      t0,
      t1,
      pelvis0: pelvis,
      pelvis1,
      h0: height,
      h1,
      anchor0: anchors[foot],
      anchor1,
    });
    pelvis = pelvis1;
    height = h1;
    anchors[foot] = anchor1;
  }

  return { steps, turns, initialAnchors };
}

/** Body state at one time. Ankles are world positions; the stepping foot is off the floor during its lift. */
export type BodyState = {
  yaw: number;
  axes: BodyAxes;
  pelvis: Vec3;
  ankles: Record<Foot, Vec3>;
  /** True while a step of the foot is in progress. */
  stepping: Record<Foot, boolean>;
};

/** Pelvis position and height at time t, from the last step that has started. */
function pelvisAt(plan: BodyPlan, t: number): { xz: XZ; h: number } {
  let last: StepPlan | undefined;
  for (const s of plan.steps) if (s.t0 <= t) last = s;
  if (!last) return { xz: { x: PELVIS.x, z: PELVIS.z }, h: PELVIS.y };
  if (t >= last.t1) return { xz: last.pelvis1, h: last.h1 };
  const u = smoothstep((t - last.t0) / (last.t1 - last.t0));
  return {
    xz: interpolateXZ(last.pelvis0, last.pelvis1, u),
    h: last.h0 + (last.h1 - last.h0) * u,
  };
}

/** Ankle position of a foot at time t: lifted during its step, otherwise planted on its last landing spot. */
function ankleAt(plan: BodyPlan, foot: Foot, t: number): { pos: Vec3; stepping: boolean } {
  for (const s of plan.steps) {
    if (s.foot === foot && s.t0 <= t && t < s.t1) {
      const u = (t - s.t0) / (s.t1 - s.t0);
      const xz = interpolateXZ(s.anchor0, s.anchor1, smoothstep(u));
      const ramp = Math.max(0, Math.min(1, u / LIFT_RAMP, (1 - u) / LIFT_RAMP));
      return { pos: { x: xz.x, y: LIFT_HEIGHT * ramp, z: xz.z }, stepping: true };
    }
  }
  let landed: XZ = plan.initialAnchors[foot];
  for (const s of plan.steps) if (s.foot === foot && s.t1 <= t) landed = s.anchor1;
  return { pos: { x: landed.x, y: 0, z: landed.z }, stepping: false };
}

/**
 * Body state at time t (supports-and-turns Requirement 3). Yaw follows the turns, the pelvis follows the steps, and each
 * ankle follows its foot's step or stays planted.
 * @param plan Result of `planBody`.
 * @param t Time in seconds.
 */
export function bodyAt(plan: BodyPlan, t: number): BodyState {
  const yaw = yawAt(plan.turns, t);
  const axes = bodyAxesFromYaw(yaw);
  const p = pelvisAt(plan, t);
  const left = ankleAt(plan, 'left', t);
  const right = ankleAt(plan, 'right', t);
  return {
    yaw,
    axes,
    pelvis: { x: p.xz.x, y: p.h, z: p.xz.z },
    ankles: { left: left.pos, right: right.pos },
    stepping: { left: left.stepping, right: right.stepping },
  };
}
