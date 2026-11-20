import { isTurnSymbol } from './symbol';
import type { Cell, ColumnId, Direction, Frame, JointName, Score, Symbol, Vec3 } from './types';

/** Swaps `left` and `right` inside a name, for example `left-forward` to `right-forward`. */
function swapSide(name: string): string {
  return name.replace(/left|right/g, (m) => (m === 'left' ? 'right' : 'left'));
}

/** Returns the column on the other side of the centre line. */
function mirrorColumn(column: ColumnId): ColumnId {
  return swapSide(column) as ColumnId;
}

function mirrorCell(cell: Cell): Cell {
  return { direction: swapSide(cell.direction) as Direction, level: cell.level };
}

/** Returns the joint on the other side of the body. Joints without a side are returned unchanged. */
function mirrorJoint(name: JointName): JointName {
  return swapSide(name) as JointName;
}

/**
 * Mirrors a score (Requirement 6.1, rule in `.kiro/steering/notation.md`). Columns and direction names swap left and
 * right. Forward, backward, levels and beats stay. Symbol ids swap a leading `left-` or `right-`, so mirroring twice
 * gives back the original ids. The symbol order is kept.
 * @param score A score. It is not modified.
 */
export function mirrorScore(score: Score): Score {
  const startPosition: Partial<Record<ColumnId, Cell>> = {};
  for (const [column, cell] of Object.entries(score.startPosition) as [ColumnId, Cell][]) {
    startPosition[mirrorColumn(column)] = mirrorCell(cell);
  }
  const result: Score = {
    version: score.version,
    title: score.title,
    tempo: score.tempo,
    beatsPerBar: score.beatsPerBar,
    grid: score.grid,
    startPosition,
    symbols: score.symbols.map((s): Symbol => {
      const id = s.id.replace(/^(left|right)-/, (_m, side: string) => (side === 'left' ? 'right-' : 'left-'));
      if (isTurnSymbol(s)) {
        return {
          id,
          kind: 'turn',
          column: mirrorColumn(s.column) as 'left-support' | 'right-support',
          start: s.start,
          duration: s.duration,
          rotation: s.rotation === 'cw' ? 'ccw' : 'cw',
          amount: s.amount,
        };
      }
      return {
        id,
        column: mirrorColumn(s.column),
        start: s.start,
        duration: s.duration,
        direction: swapSide(s.direction) as Direction,
        level: s.level,
      };
    }),
  };
  if (score.source !== undefined) result.source = score.source;
  return result;
}

/**
 * Mirrors frames (Requirement 6.2): negates x on every joint and swaps each left joint with its right joint.
 * @param frames Frames. They are not modified.
 */
export function mirrorFrames(frames: Frame[]): Frame[] {
  return frames.map((f) => {
    const joints = {} as Record<JointName, Vec3>;
    for (const [name, p] of Object.entries(f.joints) as [JointName, Vec3][]) {
      joints[mirrorJoint(name)] = { x: -p.x, y: p.y, z: p.z };
    }
    return { t: f.t, joints };
  });
}

/**
 * Multiplies the tempo by `factor` and keeps every symbol's beats (Requirement 6.3).
 * @param score A score. It is not modified.
 * @param factor Positive number. 2 makes the score twice as fast.
 * @throws RangeError when `factor` is not positive.
 */
export function retime(score: Score, factor: number): Score {
  if (!(factor > 0)) throw new RangeError(`retime: factor must be positive, got ${factor}`);
  return { ...score, tempo: score.tempo * factor };
}
