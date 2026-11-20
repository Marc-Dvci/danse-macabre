import { z } from 'zod';
import { perform, renderStaffSvg } from '@danse/core';
import { okResult } from '../result';
import { defineTool } from '../tool';
import { ScoreSchema } from '../schemas';
import { invalidScore, writeInWorkspace } from './common';

const DEFAULT_FPS = 30;

export const performScore = defineTool({
  name: 'perform_score',
  description:
    'Plays a score on the 3D skeleton and returns its frames (time in seconds, 15 joints in metres); writes them to a JSON file when outPath is given.',
  input: z.object({
    score: ScoreSchema,
    fps: z.number().int().positive().optional().describe('Frames per second. Default 30.'),
    outPath: z.string().min(1).optional().describe('File to write, relative to the workspace root.'),
  }),
  run: async ({ score, fps, outPath }, ctx) => {
    const invalid = invalidScore(score, 'score');
    if (invalid) return invalid;
    const rate = fps ?? DEFAULT_FPS;
    const frames = perform(score, { fps: rate });
    if (outPath === undefined) return okResult({ fps: rate, frames });
    const path = await writeInWorkspace(ctx, outPath, JSON.stringify({ fps: rate, frames }));
    return okResult({ path, fps: rate, frames: frames.length });
  },
});

export const renderScoreSvg = defineTool({
  name: 'render_score_svg',
  description: 'Draws a score as a Labanotation staff in SVG; writes the SVG to a file when outPath is given.',
  input: z.object({
    score: ScoreSchema,
    outPath: z.string().min(1).optional().describe('File to write, relative to the workspace root.'),
  }),
  run: async ({ score, outPath }, ctx) => {
    const invalid = invalidScore(score, 'score');
    if (invalid) return invalid;
    const svg = renderStaffSvg(score);
    if (outPath === undefined) return okResult({ svg });
    const path = await writeInWorkspace(ctx, outPath, svg);
    return okResult({ path, bytes: Buffer.byteLength(svg, 'utf8') });
  },
});
