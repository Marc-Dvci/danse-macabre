# Design: dance-mcp

Implements `requirements.md` in `packages/mcp` (`@danse/mcp`) and `power/labanotation/`. The server only calls the public
API of `@danse/core` (`packages/core/src/index.ts`). It does not edit `packages/core`.

## Stack

- `@modelcontextprotocol/sdk` (1.x): low-level `Server` with `ListTools`, `CallTool`, `ListResources` and
  `ReadResource` handlers, `StdioServerTransport` for the binary, `InMemoryTransport` for tests. The high-level
  `McpServer` is not used: it validates arguments before the handler runs and answers a bad call with a protocol error,
  while Requirement 1.2 asks for an error result that lists every problem.
- `zod` 3.25 (`^3.25.76`): tool input schemas, checked by the server in `defineTool`.
- `zod-to-json-schema`: builds each tool's JSON input schema from its zod schema.
- Runtime: Node 24 with `tsx`, because `@danse/core` is TypeScript source with extensionless imports and has no build.
- Tests: vitest.

## Modules (`packages/mcp/src`)

| File | Purpose |
| --- | --- |
| `server.ts` | `createServer(options)`: builds the `McpServer`, registers all tools and the clip resources. |
| `bin.ts` | Stdio entry point. Reads `DANSE_WORKSPACE` (default `process.cwd()`), connects `StdioServerTransport`. |
| `index.ts` | Public exports: `createServer`, `composeScore`. |
| `schemas.ts` | Zod schemas for score, symbol, cell, column, frame and move input. |
| `compose.ts` | `composeScore(input)`: moves to a `Score`, then `validateScore`. |
| `paths.ts` | `resolveInWorkspace(workspace, p)`: the only place that turns a path into a file path. |
| `clips.ts` | `listClips(workspace)`, `readClipFile(workspace, path)`: reads `data/clips/*.json`. |
| `result.ts` | `okResult(value)`, `errorResult(errors)`: builds MCP tool results. |
| `tools/*.ts` | One file per tool group (`notate.ts`, `check.ts`, `edit.ts`, `play.ts`, `compose.ts`). Each exports tool specs. |

## Exported functions and signatures

```ts
// server.ts
export type ServerOptions = { workspace: string };
export function createServer(options: ServerOptions): Server; // @modelcontextprotocol/sdk/server/index.js

// bin.ts: no exports. Reads env DANSE_WORKSPACE, calls createServer, connects stdio.

// compose.ts
export type Move =
  | { count: number; column: ColumnId; direction: Direction; level: Level; counts: number }
  | { count: number; column: ColumnId; turn: 'cw' | 'ccw'; amount: 0.25 | 0.5 | 0.75 | 1; counts: number };
export type ComposeInput = {
  title: string; tempo: number; beatsPerBar: number; grid: number;
  startPosition?: Partial<Record<ColumnId, Cell>>; moves: Move[];
};
export type ComposeResult = { ok: true; score: Score } | { ok: false; errors: string[] };
export function composeScore(input: ComposeInput): ComposeResult;

// paths.ts
export class WorkspaceError extends Error {}
export function resolveInWorkspace(workspace: string, p: string): string; // throws WorkspaceError

// clips.ts
export type ClipSummary = { id: string; title: string; source: unknown; path: string };
export function listClips(workspace: string): Promise<ClipSummary[]>;
export function readClipFrames(workspace: string, clipPath: string): Promise<Frame[]>; // uses clip fps and joints

// result.ts
export type ToolResult = { content: [{ type: 'text'; text: string }]; isError?: boolean };
export function okResult(value: unknown): ToolResult;   // JSON text
export function errorResult(errors: string[]): ToolResult; // isError: true, one line per error
```

`composeScore` maps move `count` (1-based across the phrase) to `start = count - 1` beats. `grid` must divide every
start and duration, which `validateScore` checks. The score has `version: 1` and symbol ids `m<index>-<column>`
(index is the move's position in the input, 1-based). Gesture columns take direction moves only, and support
columns take direction or turn moves. `validateScore` decides the second rule.

## Tools

Each tool has a one-sentence description and a zod input schema. Errors are returned as `errorResult`, never thrown.

| Tool | Input | Output (JSON text) |
| --- | --- | --- |
| `notate_clip` | `clipPath` or `frames`, `tempo`, `beatsPerBar`, `grid`, `title?` | score |
| `validate_score` | `score` | `{ ok, errors }` |
| `describe_score` | `score` | `{ lines: LessonLine[] }` |
| `mirror_score` | `score` | score |
| `retime_score` | `score`, `factor` | score |
| `find_phrase` | `score`, `phrase`, `mirror?` | `{ matches: PhraseMatch[] }` |
| `perform_score` | `score`, `fps?`, `outPath?` | frames, or `{ path, frames, fps }` when `outPath` is set |
| `render_score_svg` | `score`, `outPath?` | `{ svg }`, and writes the file when `outPath` is set |
| `compose_score` | `ComposeInput` | score, or `errorResult` |

Input rules:

- A score is parsed by `ScoreSchema` first. A shape error (missing field, unknown direction name, turn sign outside a
  support column, turn amount other than 0.25, 0.5, 0.75, 1) is an `errorResult`, because the zod types match the
  `Score` type. Semantic errors (`validateScore`, for example "place middle" in an arm) are an `errorResult` for every
  tool except `validate_score`, which returns them as `{ ok: false, errors }`.
- `notate_clip` takes exactly one of `clipPath` and `frames`. The clip path is read from the workspace. `frames` is a
  list of `Frame` objects with all 15 joints. `title` defaults to the clip's title, or `"Untitled"` for `frames`.
- `retime_score.factor` must be positive. `perform_score.fps` must be a positive integer, default 30.

## Workspace access (Requirement 1.3)

`resolveInWorkspace(workspace, p)` joins `p` to `workspace` when `p` is relative, then rejects the result if
`path.relative(workspace, resolved)` starts with `..` or is absolute. Every file read and write goes through it. When
the target exists, the real path (`fs.realpath`) must also lie inside the realpath of the workspace, so a symbolic link
cannot leave the workspace. Writes create parent directories inside the workspace only.

## Clip resources (Requirement 1.4)

`listClips` reads every `*.json` file in `<workspace>/data/clips/` except `index.json`. Each becomes a resource with
URI `clip://<id>`, where `id` is the file's `id` field, a name equal to the title, and a description equal to
`source.database` with the subject and trial. `resources/read` returns the clip JSON text.

## Power (Requirement 2)

```
power/labanotation/
  plugin.json                       name, version, description, author, keywords
  mcp.json                          { "mcpServers": { "danse-macabre": { "command": "npx", "args": ["tsx", "packages/mcp/src/bin.ts"] } } }
  skills/read-and-write-dance/SKILL.md
```

The `mcp.json` path is relative to the workspace root, so the power works when Kiro starts the server from this
repository. The skill tells the agent how to compose a phrase, validate it, and describe it.

## Correctness properties

| # | Property | Requirement | Test |
| --- | --- | --- | --- |
| P1 | Every tool, given invalid input, returns `isError: true` with at least one problem line and does not throw. | 1.2 | `tools.test.ts` (invalid call per tool) |
| P2 | Every tool, given valid input, returns a non-error result. | 1.1 | `tools.test.ts` (valid call per tool) |
| P3 | A path outside the workspace (`../x`, an absolute path elsewhere) is rejected for read and write. | 1.3 | `paths.test.ts` |
| P4 | `compose_score` writes `start = count - 1` for every move and returns a score that passes `validateScore`, or the validation errors. | 1.1 | `compose.test.ts` |
| P5 | `listClips` returns one resource per clip file with its title and source, and no `index.json`. | 1.4 | `clips.test.ts` |
| P6 | The Macarena's first eight counts, composed with `compose_score`, produce a lesson line for count 1 that contains "right arm moves forward, middle". | 3.2 | `compose.test.ts` |

## Out of scope

- Turn signs in `describe_score`: `@danse/core`'s `describe` reads direction symbols only. Whether it speaks turns is
  the owner's decision in `packages/core`.
- Property-based tests in `packages/mcp`. The tests here are examples; core holds the property tests.
- Resources for scores other than clips.
