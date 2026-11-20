import { z } from 'zod';
import { notate, validateScore, type Frame } from '@danse/core';
import { readClipFile, readClipFrames } from '../clips';
import { FrameSchema } from '../schemas';
import { okResult, errorResult } from '../result';
import { defineTool } from '../tool';

export const notateClip = defineTool({
  name: 'notate_clip',
  description:
    'Writes a motion-capture clip (a path under the workspace, such as data/clips/macarena.json) or a list of frames down as a Labanotation score.',
  input: z
    .object({
      clipPath: z.string().min(1).optional().describe('Clip file path relative to the workspace root.'),
      frames: z.array(FrameSchema).min(1).optional().describe('Frames in time order, all 15 joints in metres.'),
      tempo: z.number().positive().describe('Beats per minute.'),
      beatsPerBar: z.number().int().min(1).describe('Counts per bar.'),
      grid: z.number().positive().describe('Grid unit in beats, for example 0.5.'),
      title: z.string().optional().describe('Score title. Defaults to the clip title, or "Untitled".'),
    })
    .refine((v) => (v.clipPath !== undefined) !== (v.frames !== undefined), {
      message: 'give exactly one of clipPath and frames',
    }),
  run: async (args, ctx) => {
    let frames: Frame[];
    let title = args.title;
    if (args.clipPath !== undefined) {
      frames = await readClipFrames(ctx.workspace, args.clipPath);
      title ??= (await readClipFile(ctx.workspace, args.clipPath)).title;
    } else {
      frames = args.frames as Frame[];
    }
    const score = notate(frames, {
      tempo: args.tempo,
      beatsPerBar: args.beatsPerBar,
      grid: args.grid,
      title: title ?? 'Untitled',
    });
    const check = validateScore(score);
    if (!check.ok) return errorResult(check.errors);
    return okResult(score);
  },
});
