/** The result of a tool call, in the shape the MCP SDK expects. */
export type ToolResult = {
  content: [{ type: 'text'; text: string }];
  isError?: boolean;
};

/**
 * Builds a successful tool result. The value is written as indented JSON. A string is written as it is.
 * @param value Any JSON-serialisable value, or a string.
 */
export function okResult(value: unknown): ToolResult {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text }] };
}

/**
 * Builds a failed tool result with one line per problem, so the agent can fix every problem in one call.
 * @param errors Problems, in reading order. An empty list still produces one line.
 */
export function errorResult(errors: string[]): ToolResult {
  const lines = errors.length > 0 ? errors : ['unknown error'];
  return { content: [{ type: 'text', text: lines.join('\n') }], isError: true };
}
