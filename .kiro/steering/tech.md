---
inclusion: always
---

# Danse Macabre: tech

- TypeScript (strict), Node 24, pnpm 9 workspaces. ES modules only.
- `packages/core`: pure functions, no DOM, no Node APIs, no dependencies at runtime. The browser app, the MCP server
  and the tests all import it.
- `packages/mcp`: MCP server over stdio (`@modelcontextprotocol/sdk`) exposing core functions as tools.
- `web/`: Vite app (built separately; do not edit it unless a task says so).
- Tests: vitest. Property-based tests: fast-check, in files named `*.prop.test.ts`; example tests in `*.test.ts`.
- Commands, from the repository root:
  - `pnpm install`
  - `pnpm -r test` (all tests), `pnpm --filter @danse/core test` (core only)
  - `pnpm --filter @danse/core test:props` (property tests only)
  - `pnpm -r typecheck`
- Units: positions in metres, right-handed axes with y up (the same as three.js and the CMU motion capture). A dancer
  facing +z has their right side toward −x. Time in seconds for frames and in beats for scores. Angles in degrees in
  the public API.
- When a test fails, decide whether the code, the test or the requirement is wrong, and say which with the
  counterexample. Never weaken a test to make it pass.
- Keep files small and named by what they do. Export a typed public API from `packages/core/src/index.ts`.
- Write documentation like developer docs: what a function does, its inputs and outputs. No marketing words.
