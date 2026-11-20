/**
 * A point or direction in metres. Axes are right-handed with y up. A dancer facing +z has their right side toward −x
 * and their left side toward +x (the same convention as three.js and the CMU motion capture).
 */
export type Vec3 = { x: number; y: number; z: number };

export type JointName =
  | 'pelvis'
  | 'left-hip'
  | 'right-hip'
  | 'left-knee'
  | 'right-knee'
  | 'left-ankle'
  | 'right-ankle'
  | 'left-shoulder'
  | 'right-shoulder'
  | 'left-elbow'
  | 'right-elbow'
  | 'left-wrist'
  | 'right-wrist'
  | 'neck'
  | 'head';

/** One pose. `t` is in seconds. Joint positions are in metres. */
export type Frame = { t: number; joints: Record<JointName, Vec3> };

export type ColumnId =
  | 'left-support'
  | 'right-support'
  | 'left-leg'
  | 'right-leg'
  | 'left-arm'
  | 'right-arm';

export type Direction =
  | 'place'
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'left-forward'
  | 'right-forward'
  | 'left-backward'
  | 'right-backward';

export type Level = 'high' | 'middle' | 'low';

/** A direction and a level. Gesture cells are the 24 sector cells plus `place high` and `place low`. */
export type Cell = { direction: Direction; level: Level };

/**
 * A direction symbol: a gesture in a gesture column, or a step in a support column. `start` and `duration` are in beats.
 * `kind` may be left out; a symbol without `kind` is a direction symbol.
 */
export type DirectionSymbol = {
  id: string;
  kind?: 'direction';
  column: ColumnId;
  start: number;
  duration: number;
  direction: Direction;
  level: Level;
};

/** A turn sign in a support column. `rotation` is seen from above. `amount` is a fraction of a full turn. */
export type TurnSymbol = {
  id: string;
  kind: 'turn';
  column: 'left-support' | 'right-support';
  start: number;
  duration: number;
  rotation: 'cw' | 'ccw';
  amount: 0.25 | 0.5 | 0.75 | 1;
};

/** One written symbol. */
export type Symbol = DirectionSymbol | TurnSymbol;

export type Score = {
  version: 1;
  title: string;
  /** Beats per minute. */
  tempo: number;
  beatsPerBar: number;
  /** Grid unit in beats. */
  grid: number;
  startPosition: Partial<Record<ColumnId, Cell>>;
  symbols: Symbol[];
  source?: string;
};

/** Orthonormal axes of the dancer's body. `right` and `forward` are horizontal. */
export type BodyAxes = { up: Vec3; right: Vec3; forward: Vec3 };

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };
