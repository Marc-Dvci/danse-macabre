# Tasks: dance-mcp

Dependency order. Each task lists the requirements it covers and the property (P#) from design.md.

- [x] 1. Package skeleton: `packages/mcp/package.json` (`@danse/mcp`, `bin`, `start` script, dependencies on
  `@danse/core` (workspace), `@modelcontextprotocol/sdk`, `zod`, `zod-to-json-schema`), `tsconfig.json`. Req 1, 2.
  Ran `pnpm install`; added `@types/node` to this package.
- [x] 2. Wrote `test/paths.test.ts` (P3), then `paths.ts` and `result.ts`. Req 1.2, 1.3.
- [x] 3. Wrote `test/compose.test.ts` (P4, P6), then `schemas.ts` and `compose.ts`. Req 1.1.
- [x] 4. Wrote `test/clips.test.ts` (P5), then `clips.ts`. Req 1.4.
- [x] 5. Wrote `test/tools.test.ts` (P1, P2: in-memory transport, list tools, each tool valid and invalid), then
  `tool.ts`, `tools/*.ts` and `server.ts`. Req 1.1, 1.2, 3.1.
- [x] 6. `bin.ts` and `index.ts`. Req 1 (stdio server).
- [x] 7. Power: `power/labanotation/plugin.json`, `mcp.json`, `skills/read-and-write-dance/SKILL.md`. Req 2.
- [x] 8. Finale: `examples/compose-finale.mjs` (MCP client over stdio, tool calls only). Wrote the 16-bar score with
  `compose_score`, checked it with `validate_score`, saved `examples/danse-macabre.score.json`,
  `examples/danse-macabre.svg` (via `render_score_svg`), and `examples/danse-macabre-lesson.txt`. Req 1 (end to end).
- [x] 9. `pnpm --filter @danse/mcp test` (45 passed) and `pnpm --filter @danse/mcp typecheck` (exit 0).
