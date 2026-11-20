import type { ColumnId, Frame, JointName, Vec3 } from './types';
import { add, scale } from './vec';

/** Segment lengths and joint offsets of the standard rig, in metres. */
export type Rig = {
  /** Distance from the pelvis centre to each hip joint along x. The right hip is at −x. */
  hipHalfWidth: number;
  /** Distance from the neck to each shoulder joint along x. The right shoulder is at −x. */
  shoulderHalfWidth: number;
  /** Shoulder to wrist. */
  armLength: number;
  /** Hip to ankle. */
  legLength: number;
};

/** Pelvis position in metres. It is fixed in this spec (Requirement 5.3). */
export const PELVIS: Vec3 = { x: 0, y: 0.95, z: 0 };
const SHOULDER_HEIGHT = 1.42;
const NECK: Vec3 = { x: 0, y: 1.45, z: 0 };
const HEAD: Vec3 = { x: 0, y: 1.6, z: 0 };

/** The standard rig: hips 0.18 m apart, shoulders 0.36 m apart, arm 0.6 m, leg 0.9 m. */
export function standardRig(): Rig {
  return { hipHalfWidth: 0.09, shoulderHalfWidth: 0.18, armLength: 0.6, legLength: 0.9 };
}

/** Returns the joint that is the base of a gesture column: the shoulder for arms, the hip for legs. */
export function limbBaseJoint(column: ColumnId): JointName {
  switch (column) {
    case 'left-arm':
      return 'left-shoulder';
    case 'right-arm':
      return 'right-shoulder';
    case 'left-leg':
      return 'left-hip';
    case 'right-leg':
      return 'right-hip';
    default:
      throw new RangeError(`limbBaseJoint: "${column}" is not a gesture column`);
  }
}

/** Returns the joint that is the free end of a gesture column: the wrist for arms, the ankle for legs. */
export function limbEndJoint(column: ColumnId): JointName {
  switch (column) {
    case 'left-arm':
      return 'left-wrist';
    case 'right-arm':
      return 'right-wrist';
    case 'left-leg':
      return 'left-ankle';
    case 'right-leg':
      return 'right-ankle';
    default:
      throw new RangeError(`limbEndJoint: "${column}" is not a gesture column`);
  }
}

/**
 * Builds a full frame from the unit direction of each limb. The body faces +z, so its right side is at −x. Joints off
 * the limbs are fixed. Elbows and knees sit at the midpoint of their bones.
 * @param t Time of the frame in seconds.
 * @param dirs Unit vector of each gesture column, from its base joint to its free end.
 * @param rig Segment lengths.
 */
export function buildFrame(t: number, dirs: Record<'left-arm' | 'right-arm' | 'left-leg' | 'right-leg', Vec3>, rig: Rig): Frame {
  // Right is −x (dancer facing +z), so the left joints are at +x.
  const leftHip = add(PELVIS, { x: rig.hipHalfWidth, y: 0, z: 0 });
  const rightHip = add(PELVIS, { x: -rig.hipHalfWidth, y: 0, z: 0 });
  const leftShoulder = { x: rig.shoulderHalfWidth, y: SHOULDER_HEIGHT, z: 0 };
  const rightShoulder = { x: -rig.shoulderHalfWidth, y: SHOULDER_HEIGHT, z: 0 };
  const leftWrist = add(leftShoulder, scale(dirs['left-arm'], rig.armLength));
  const rightWrist = add(rightShoulder, scale(dirs['right-arm'], rig.armLength));
  const leftAnkle = add(leftHip, scale(dirs['left-leg'], rig.legLength));
  const rightAnkle = add(rightHip, scale(dirs['right-leg'], rig.legLength));
  const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);

  return {
    t,
    joints: {
      pelvis: PELVIS,
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
      neck: NECK,
      head: HEAD,
    },
  };
}
