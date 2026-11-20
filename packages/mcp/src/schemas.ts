import { z } from 'zod';

/*
 * Zod schemas for tool input. They check the shape: types, required fields and enum names. Meaning (for example
 * "place middle" in an arm column, or overlapping symbols) is checked later by `validateScore` from @danse/core.
 */

export const ColumnIdSchema = z.enum([
  'left-support',
  'right-support',
  'left-leg',
  'right-leg',
  'left-arm',
  'right-arm',
]);

export const DirectionSchema = z.enum([
  'place',
  'forward',
  'backward',
  'left',
  'right',
  'left-forward',
  'right-forward',
  'left-backward',
  'right-backward',
]);

export const LevelSchema = z.enum(['high', 'middle', 'low']);

export const CellSchema = z.object({ direction: DirectionSchema, level: LevelSchema });

export const StartPositionSchema = z.object({
  'left-support': CellSchema.optional(),
  'right-support': CellSchema.optional(),
  'left-leg': CellSchema.optional(),
  'right-leg': CellSchema.optional(),
  'left-arm': CellSchema.optional(),
  'right-arm': CellSchema.optional(),
});

const DirectionSymbolSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('direction').optional(),
  column: ColumnIdSchema,
  start: z.number().finite(),
  duration: z.number().finite(),
  direction: DirectionSchema,
  level: LevelSchema,
});

const TurnSymbolSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('turn'),
  column: z.enum(['left-support', 'right-support']),
  start: z.number().finite(),
  duration: z.number().finite(),
  rotation: z.enum(['cw', 'ccw']),
  amount: z.union([z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1)]),
});

export const SymbolSchema = z.union([TurnSymbolSchema, DirectionSymbolSchema]);

export const ScoreSchema = z.object({
  version: z.literal(1).default(1),
  title: z.string(),
  tempo: z.number(),
  beatsPerBar: z.number(),
  grid: z.number(),
  startPosition: StartPositionSchema.default({}),
  symbols: z.array(SymbolSchema),
  source: z.string().optional(),
});

const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

/** One pose: time in seconds and all 15 joints in metres. */
export const FrameSchema = z.object({
  t: z.number().finite(),
  joints: z.object({
    pelvis: Vec3Schema,
    'left-hip': Vec3Schema,
    'right-hip': Vec3Schema,
    'left-knee': Vec3Schema,
    'right-knee': Vec3Schema,
    'left-ankle': Vec3Schema,
    'right-ankle': Vec3Schema,
    'left-shoulder': Vec3Schema,
    'right-shoulder': Vec3Schema,
    'left-elbow': Vec3Schema,
    'right-elbow': Vec3Schema,
    'left-wrist': Vec3Schema,
    'right-wrist': Vec3Schema,
    neck: Vec3Schema,
    head: Vec3Schema,
  }),
});

const DirectionMoveSchema = z.object({
  count: z.number().int().min(1),
  column: ColumnIdSchema,
  direction: DirectionSchema,
  level: LevelSchema,
  counts: z.number().positive().default(1),
});

const TurnMoveSchema = z.object({
  count: z.number().int().min(1),
  column: ColumnIdSchema,
  turn: z.enum(['cw', 'ccw']),
  amount: z.union([z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1)]),
  counts: z.number().positive().default(1),
});

export const MoveSchema = z.union([DirectionMoveSchema, TurnMoveSchema]);

export const ComposeInputSchema = z.object({
  title: z.string(),
  tempo: z.number().positive(),
  beatsPerBar: z.number().int().min(1),
  grid: z.number().positive(),
  startPosition: StartPositionSchema.optional(),
  moves: z.array(MoveSchema),
});
