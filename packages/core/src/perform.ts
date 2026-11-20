import { WORLD_AXES } from './body-frame';
import { bodyAt, planBody, type BodyState } from './perform-body';
import { buildFrame, standardRig, type Rig } from './rig';
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
  const leftAnkle = state.ankles.left;
  const rightAnkle = state.ankles.right;

  const joints: Record<JointName, Vec3> = {
    pelvis,
    'left-hip': leftHip,
    'right-hip': rightHip,
    'left-knee': mid(leftHip, leftAnkle),
    'right-knee': mid(rightHip, rightAnkle),
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
  for (const s of score.symbols) {
    if (s.column === 'left-leg' || s.column === 'right-leg') {
      legWindows[s.column].push([s.start * beatSeconds, (s.start + s.duration) * beatSeconds]);
    }
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
