# Requirements: dance-mcp (MCP server and Kiro power)

## Introduction

`packages/mcp` (`@danse/mcp`) exposes the notation engine to AI agents over the Model Context Protocol (stdio), so
an agent can read, write, perform and describe dance. `power/labanotation/` packages it as a Kiro power. The server
only calls `@danse/core`; it holds no model and makes no network calls.

## Requirement 1: tools

**User story:** As an agent, I want notation tools, so that I can read and write dance for a user.

1. THE SYSTEM SHALL register these tools, each with a JSON schema for its input and a one-sentence description:
   - `notate_clip`: `{ clipPath | frames, tempo, beatsPerBar, grid, title }` to a score;
   - `validate_score`: score to `{ ok, errors }`;
   - `describe_score`: score to the spoken lesson lines;
   - `mirror_score`, `retime_score`;
   - `find_phrase`: `{ score, phrase, mirror }` to matches;
   - `perform_score`: score to frames (`fps`), written to a file when `outPath` is given;
   - `render_score_svg`: score to an SVG string, written to a file when `outPath` is given;
   - `compose_score`: a list of `{ count, column, direction, level, counts }` steps to a valid score (the way an agent
     writes a phrase), rejecting invalid input with the validation errors.
2. WHEN a tool receives invalid input THE SYSTEM SHALL return an MCP error result whose text lists every problem,
   and SHALL not throw.
3. THE SYSTEM SHALL read and write files only inside the directory given by `DANSE_WORKSPACE` (default: the current
   directory) and reject any other path.
4. THE SYSTEM SHALL list the clips in `data/clips/` as MCP resources (`clip://<id>`), with title and source.

## Requirement 2: power

**User story:** As a Kiro user, I want to add dance notation to my agent in one step.

1. THE SYSTEM SHALL provide `power/labanotation/plugin.json` (Agent Plugins schema: name, version, description,
   author, keywords such as dance, choreography, labanotation, notation, movement), `power/labanotation/mcp.json`
   starting the server with `npx`/`node`, and `power/labanotation/skills/read-and-write-dance/SKILL.md` explaining how
   to compose a phrase, check it with `validate_score`, and describe it.

## Requirement 3: tests

1. An in-process test SHALL start the server with an in-memory transport, list the tools, and call each tool once with
   valid and once with invalid input.
2. A test SHALL compose the Macarena's first eight counts with `compose_score`, then check that `describe_score`
   mentions "right arm moves forward, middle" on count 1.
