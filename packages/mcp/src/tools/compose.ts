import { composeScore } from '../compose';
import { ComposeInputSchema } from '../schemas';
import { errorResult, okResult } from '../result';
import { defineTool } from '../tool';

export const composeScoreTool = defineTool({
  name: 'compose_score',
  description:
    'Writes a phrase from moves: each move names a count, a column, a direction and level (or a turn), and a length in counts. Returns a valid score or the errors.',
  input: ComposeInputSchema,
  run: (args) => {
    const result = composeScore(args);
    return result.ok ? okResult(result.score) : errorResult(result.errors);
  },
});
