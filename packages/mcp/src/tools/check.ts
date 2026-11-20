import { z } from 'zod';
import { describe as lessonOf, validateScore } from '@danse/core';
import { okResult } from '../result';
import { defineTool } from '../tool';
import { ScoreSchema } from '../schemas';
import { invalidScore } from './common';

export const validateScoreTool = defineTool({
  name: 'validate_score',
  description: 'Checks a score against the notation rules and returns { ok, errors } with one message per problem.',
  input: z.object({ score: ScoreSchema }),
  run: ({ score }) => okResult(validateScore(score)),
});

export const describeScore = defineTool({
  name: 'describe_score',
  description: 'Writes a valid score as the spoken lesson: one line per count, each naming the symbols that start there.',
  input: z.object({ score: ScoreSchema }),
  run: ({ score }) => {
    const invalid = invalidScore(score, 'score');
    if (invalid) return invalid;
    return okResult({ lines: lessonOf(score) });
  },
});
