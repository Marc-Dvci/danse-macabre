// Public API of @danse/core. See .kiro/specs/laban-core.
export type {
  Vec3,
  Frame,
  JointName,
  ColumnId,
  Direction,
  Level,
  Cell,
  Symbol,
  DirectionSymbol,
  TurnSymbol,
  Score,
  BodyAxes,
  ValidationResult,
} from './types';
export { validateScore, canonicalScore, GESTURE_COLUMNS, COLUMN_ORDER, DIRECTIONS, LEVELS } from './score';
export { isTurnSymbol, isDirectionSymbol, directionSymbols } from './symbol';
export { bodyFrame, WORLD_AXES } from './body-frame';
export { quantizeGesture, cellCenter, GESTURE_CELLS, SECTOR_NAMES } from './quantize';
export { standardRig, type Rig } from './rig';
export { performGestures, perform, type PerformOptions } from './perform';
export { notateGestures, notate, type NotateOptions, type NotateAllOptions } from './notate';
export { notateSupports, type SupportOptions, type SupportNotateOptions } from './notate-supports';
export { mirrorScore, mirrorFrames, retime } from './mirror';
export { describe, type LessonLine } from './lesson';
export { durationPhrase } from './lesson-words';
export { parseLesson, type LessonSymbol } from './lesson-parse';
export { findPhrase, type PhraseMatch, type FindPhraseOptions } from './search';
export {
  layoutStaff,
  type StaffOptions,
  type StaffLayout,
  type StaffGlyph,
  type StaffColumn,
  type StaffColumnId,
  type StaffLine,
  type StaffBar,
  type StaffCount,
} from './layout';
export type { Point } from './layout-shapes';
export { renderStaffSvg } from './staff-svg';
export { replayFidelity, type FidelityOptions, type FidelityResult } from './fidelity';
