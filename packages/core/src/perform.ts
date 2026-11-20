import { WORLD_AXES } from './body-frame';
import { bodyAt, planBody, type BodyState } from './perform-body';
import { buildFrame, PELVIS, standardRig, type Rig } from './rig';
import { GESTURE_COLUMNS } from './score';
import { buildTrack, sampleTrack, type Track } from './track';
import { normalize, add, scale, dot } from './vec';
import type { BodyAxes, Frame, JointName, Score, Vec3 } from './types';

export type PerformOptions = {
  /** Frames per second. Default 30. */
  fps?: number;
  /** Segment lengths. Default `standardRig()`. */
  rig?: Rig;
  /** Pelvis travel of one step, in metres (supports-and-turns Requirement 3.1). Default 0.4. */
  stepLength?: number;
};

/**
 * Plays the gesture columns of a score on the rig. Each limb holds its start cell, moves from its previous cell centre
 * to the next cell centre over the symbol's duration with ease in and out, and then holds. Support and turn symbols are
 * ignored; use `perform` for those.
 * @param score A score. Times come from `beat * 60 / tempo`.
 * @param options `fps` (default 30) and `rig` (default `standardRig()`).
 * @returns Frames from time 0 to the end of the last symbol plus one beat.
 */
export function performGestures(score: Score, options: PerformOptions = {}): Frame[] {
  const fps = options.fps ?? 30;
  const rig = options.rig ?? standardRig();
  const beatSeconds = 60 / score.tempo;
  const tracks = Object.fromEntries(
    GESTURE_COLUMNS.map((c) => [c, buildTrack(score, c, beatSeconds)]),
  ) as Record<(typeof GESTURE_COLUMNS)[number], Track>;

  let endBeat = 0;
  for (const s of score.symbols) endBeat = Math.max(endBeat, s.start + s.duration);
  const totalSeconds = (endBeat + 1) * beatSeconds;
  const last = Math.floor(totalSeconds * fps + 1e-9);

  const frames: Frame[] = [];
  for (let k = 0; k <= last; k++) {
    const t = k / fps;
    frames.push(
      buildFrame(
        t,
        {
          'left-arm': sampleTrack(tracks['left-arm'], t),
          'right-arm': sampleTrack(tracks['right-arm'], t),
          'left-leg': sampleTrack(tracks['left-leg'], t),
          'right-leg': sampleTrack(tracks['right-leg'], t),
        },
        rig,
      ),
    );
  }
  return frames;
}

/** Converts a vector given in `WORLD_AXES` coordinates to the body axes, keeping its right, up and forward parts. */
function rebase(v: Vec3, axes: BodyAxes): Vec3 {
  const r = dot(v, WORLD_AXES.right);
  const u = dot(v, WORLD_AXES.up);
  const f = dot(v, WORLD_AXES.forward);
  return add(add(scale(axes.right, r), scale(axes.up, u)), scale(axes.forward, f));
}

function inWindows(windows: [number, number][], t: number): boolean {
  return windows.some(([a, b]) => a <= t && t < b);
}

/**
 * Thigh and shin, each half of the standing leg (hip at the rig's standing pelvis height, ankle on the floor), so a
 * straight leg reaches the floor exactly at the middle level.
 */
export const THIGH = PELVIS.y / 2;
export const SHIN = PELVIS.y / 2;

/**
 * Knee and ankle of one leg. When the ankle is closer to the hip than a straight leg, the knee bends forward (in the
 * body's forward direction) with fixed thigh and shin lengths, as in a plié. When it is farther (a high level, or a
 * long step), the leg is straight and the foot stays where it is.
 */
export function legJoints(hip: Vec3, ankle: Vec3, forward: Vec3): { knee: Vec3; ankle: Vec3 } {
  const reach = THIGH + SHIN;
  const v = { x: ankle.x - hip.x, y: ankle.y - hip.y, z: ankle.z - hip.z };
  const d = Math.hypot(v.x, v.y, v.z);
  if (d < 1e-9) return { knee: add(hip, { x: 0, y: -THIGH, z: 0 }), ankle };
  const unit = scale(v, 1 / d);
  // A straight leg: the knee is halfway down it. The foot keeps its place on the floor, so a planted foot never leaves
  // contact because the pelvis has moved away from it.
  if (d >= reach) return { knee: add(hip, scale(unit, d / 2)), ankle };
  // Equal segments: the knee sits above the midpoint, pushed forward by the bend height.
  const h = Math.sqrt(Math.max(0, THIGH * THIGH - (d / 2) * (d / 2)));
  const along = dot(forward, unit);
  let bend = { x: forward.x - unit.x * along, y: forward.y - unit.y * along, z: forward.z - unit.z * along };
  const bl = Math.hypot(bend.x, bend.y, bend.z);
  bend = bl > 1e-9 ? scale(bend, 1 / bl) : { x: 0, y: 0, z: 0 };
  const midpoint = add(hip, scale(unit, d / 2));
  return { knee: add(midpoint, scale(bend, h)), ankle };
}

/** Builds the joints of one frame from the body state and the limb directions (world coordinates). */
function buildBodyFrame(t: number, state: BodyState, arm: Record<'left-arm' | 'right-arm', Vec3>, rig: Rig): Frame {
  const { axes, pelvis } = state;
  const up = axes.up;
  const R = axes.right;
  const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);
  const offset = (p: Vec3, v: Vec3, k: number): Vec3 => add(p, scale(v, k));

  const leftHip = offset(pelvis, R, -rig.hipHalfWidth);
  const rightHip = offset(pelvis, R, rig.hipHalfWidth);
  const shoulderCentre = offset(pelvis, up, 0.47);
  const leftShoulder = offset(shoulderCentre, R, -rig.shoulderHalfWidth);
  const rightShoulder = offset(shoulderCentre, R, rig.shoulderHalfWidth);
  const leftWrist = add(leftShoulder, scale(arm['left-arm'], rig.armLength));
  const rightWrist = add(rightShoulder, scale(arm['right-arm'], rig.armLength));
  const leftLeg = legJoints(leftHip, state.ankles.left, axes.forward);
  const rightLeg = legJoints(rightHip, state.ankles.right, axes.forward);
  const leftAnkle = leftLeg.ankle;
  const rightAnkle = rightLeg.ankle;

  const joints: Record<JointName, Vec3> = {
    pelvis,
    'left-hip': leftHip,
    'right-hip': rightHip,
    'left-knee': leftLeg.knee,
    'right-knee': rightLeg.knee,
    'left-ankle': leftAnkle,
    'right-ankle': rightAnkle,
    'left-shoulder': leftShoulder,
    'right-shoulder': rightShoulder,
    'left-elbow': mid(leftShoulder, leftWrist),
    'right-elbow': mid(rightShoulder, rightWrist),
    'left-wrist': leftWrist,
    'right-wrist': rightWrist,
    neck: offset(pelvis, up, 0.5),
    head: offset(pelvis, up, 0.65),
  };
  return { t, joints };
}

/**
 * Plays a whole score on the rig: gestures, steps and turns (supports-and-turns Requirement 3). The pelvis travels
 * `stepLength` in the direction of each step, rises or falls with its level, and the body turns about the vertical
 * axis through the pelvis by each turn's amount. The stepping foot lifts and lands at its new place. A foot that is not
 * stepping stays planted. Legs follow their leg gesture symbols while those are in progress.
 * @param score A valid score.
 * @param options `fps` (default 30), `rig` (default `standardRig()`), and `stepLength` (default 0.4 m).
 * @returns Frames from time 0 to the end of the last symbol plus one beat.
 */
export function perform(score: Score, options: PerformOptions = {}): Frame[] {
  const fps = options.fps ?? 30;
  const rig = options.rig ?? standardRig();
  const stepLength = options.stepLength ?? 0.4;
  const beatSeconds = 60 / score.tempo;
  const plan = planBody(score, stepLength, beatSeconds, rig.hipHalfWidth);

  const armTracks = {
    'left-arm': buildTrack(score, 'left-arm', beatSeconds),
    'right-arm': buildTrack(score, 'right-arm', beatSeconds),
  } as Record<'left-arm' | 'right-arm', Track>;
  const legTracks = {
    'left-leg': buildTrack(score, 'left-leg', beatSeconds),
    'right-leg': buildTrack(score, 'right-leg', beatSeconds),
  } as Record<'left-leg' | 'right-leg', Track>;
  const legWindows = {
    'left-leg': [] as [number, number][],
    'right-leg': [] as [number, number][],
  };
  // A blank means no change: a leg gesture holds from its symbol until the next symbol of that leg or the next step of
  // that foot, which puts the foot back under the weight.
  for (const leg of ['left-leg', 'right-leg'] as const) {
    const support = leg === 'left-leg' ? 'left-support' : 'right-support';
    const events = score.symbols.filter((s) => s.column === leg || s.column === support).map((s) => s.start);
    for (const s of score.symbols) {
      if (s.column !== leg) continue;
      const next = Math.min(Infinity, ...events.filter((b) => b > s.start));
      legWindows[leg].push([s.start * beatSeconds, next * beatSeconds]);
    }
  }
  // A leg whose start cell is a gesture (anything but place low) holds it from the start until its first leg symbol
  // or the first step of its foot, whichever comes first.
  for (const leg of ['left-leg', 'right-leg'] as const) {
    const cell = score.startPosition[leg];
    if (!cell || (cell.direction === 'place' && cell.level === 'low')) continue;
    const support = leg === 'left-leg' ? 'left-support' : 'right-support';
    let until = Infinity;
    for (const s of score.symbols) {
      if (s.column === leg || s.column === support) until = Math.min(until, s.start * beatSeconds);
    }
    if (until > 0) legWindows[leg].push([0, until]);
  }

  let endBeat = 0;
  for (const s of score.symbols) endBeat = Math.max(endBeat, s.start + s.duration);
  const totalSeconds = (endBeat + 1) * beatSeconds;
  const last = Math.floor(totalSeconds * fps + 1e-9);

  const frames: Frame[] = [];
  for (let k = 0; k <= last; k++) {
    const t = k / fps;
    const state = bodyAt(plan, t);
    const arm = {
      'left-arm': normalize(rebase(sampleTrack(armTracks['left-arm'], t), state.axes)),
      'right-arm': normalize(rebase(sampleTrack(armTracks['right-arm'], t), state.axes)),
    };
    const hipLeft = add(state.pelvis, scale(state.axes.right, -rig.hipHalfWidth));
    const hipRight = add(state.pelvis, scale(state.axes.right, rig.hipHalfWidth));
    // A leg in a leg gesture moves its free ankle from the hip. The foot in a step keeps the step's position.
    const legAnkle = (leg: 'left-leg' | 'right-leg', foot: 'left' | 'right', hip: Vec3): Vec3 | null => {
      if (state.stepping[foot] || !inWindows(legWindows[leg], t)) return null;
      const dir = normalize(rebase(sampleTrack(legTracks[leg], t), state.axes));
      return add(hip, scale(dir, rig.legLength));
    };
    const leftLeg = legAnkle('left-leg', 'left', hipLeft);
    const rightLeg = legAnkle('right-leg', 'right', hipRight);
    const body: BodyState = {
      ...state,
      ankles: {
        left: leftLeg ?? state.ankles.left,
        right: rightLeg ?? state.ankles.right,
      },
    };
    frames.push(buildBodyFrame(t, body, arm, rig));
  }
  return frames;
}
