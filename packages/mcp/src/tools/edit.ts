import { z } from 'zod';
import { findPhrase, mirrorScore, retime } from '@danse/core';
import { okResult, errorResult } from '../result';
import { defineTool } from '../tool';
import { ScoreSchema } from '../schemas';
import { invalidScore, scoreErrors } from './common';

export const mirrorScoreTool = defineTool({
  name: 'mirror_score',
  description: 'Mirrors a score left to right: swaps left and right columns and direction names, and swaps cw and ccw turns.',
  input: z.object({ score: ScoreSchema }),
  run: ({ score }) => {
    const invalid = invalidScore(score, 'score');
    return invalid ?? okResult(mirrorScore(score));
  },
});

export const retimeScore = defineTool({
  name: 'retime_score',
  description: 'Changes the speed of a score: factor 2 plays it twice as fast, factor 0.5 at half speed.',
  input: z.object({
    score: ScoreSchema,
    factor: z.number().positive().describe('Speed factor. 2 is twice as fast.'),
  }),
  run: ({ score, factor }) => {
    const invalid = invalidScore(score, 'score');
    return invalid ?? okResult(retime(score, factor));
  },
});

export const findPhraseTool = defineTool({
  name: 'find_phrase',
  description: 'Finds where a phrase (a short score) occurs in a score, optionally also in its mirror image.',
  input: z.object({
    score: ScoreSchema,
    phrase: ScoreSchema,
    mirror: z.boolean().optional().describe('Also search the mirrored phrase. Matches are flagged mirrored.'),
  }),
  run: ({ score, phrase, mirror }) => {
    const errors = [...scoreErrors(score, 'score'), ...scoreErrors(phrase, 'phrase')];
    if (errors.length > 0) return errorResult(errors);
    return okResult({ matches: findPhrase(score, phrase, { mirror: mirror ?? false }) });
  },
});
