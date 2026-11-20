import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import { errorResult, type ToolResult } from './result';

/** What a tool may use while it runs. */
export type ToolContext = { workspace: string };

/** A tool as the server lists and calls it. */
export type Tool = {
  name: string;
  description: string;
  /** JSON schema of the input, built from the zod schema. */
  inputSchema: Record<string, unknown>;
  /** Checks the raw arguments, then runs the tool. Never throws: problems become error results. */
  call: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
};

/**
 * Describes a tool. The server checks the arguments with `input` before `run` is called, so `run` receives typed,
 * valid input. A problem in the arguments returns every issue in one error result (Requirement 1.2). An exception in
 * `run` becomes an error result with its message.
 */
export function defineTool<S extends z.ZodType>(spec: {
  name: string;
  description: string;
  input: S;
  run: (args: z.output<S>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;
}): Tool {
  const inputSchema = zodToJsonSchema(spec.input, { $refStrategy: 'none' }) as Record<string, unknown>;
  return {
    name: spec.name,
    description: spec.description,
    inputSchema,
    async call(args, ctx) {
      const parsed = spec.input.safeParse(args ?? {});
      if (!parsed.success) {
        return errorResult(
          parsed.error.issues.map((issue) => {
            const where = issue.path.length > 0 ? issue.path.join('.') : 'input';
            return `${where}: ${issue.message}`;
          }),
        );
      }
      try {
        return await spec.run(parsed.data as z.output<S>, ctx);
      } catch (error) {
        return errorResult([error instanceof Error ? error.message : String(error)]);
      }
    },
  };
}
