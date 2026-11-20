import { copyFile, mkdir, mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { composeScore } from '../src/compose';
import { createServer } from '../src/server';

type Text = { content: { type: string; text: string }[]; isError?: boolean };

const REPO = resolve(import.meta.dirname, '..', '..', '..');
const TOOL_NAMES = [
  'notate_clip',
  'validate_score',
  'describe_score',
  'mirror_score',
  'retime_score',
  'find_phrase',
  'perform_score',
  'render_score_svg',
  'compose_score',
].sort();

/** A small valid score: one arm gesture, composed with compose_score. */
const SCORE = (() => {
  const r = composeScore({
    title: 'Fixture',
    tempo: 100,
    beatsPerBar: 4,
    grid: 1,
    moves: [
      { count: 1, column: 'right-arm', direction: 'forward', level: 'middle', counts: 2 },
      { count: 3, column: 'left-arm', direction: 'place', level: 'high', counts: 1 },
    ],
  });
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.score;
})();

const VALID_MOVES = [{ count: 1, column: 'right-arm', direction: 'forward', level: 'middle', counts: 1 }];

let workspace: string;
let client: Client;
let close: () => Promise<void>;

function textOf(result: unknown): string {
  return (result as Text).content[0]?.text ?? '';
}

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'danse-tools-'));
  await mkdir(join(workspace, 'data', 'clips'), { recursive: true });
  await copyFile(join(REPO, 'data', 'clips', 'macarena.json'), join(workspace, 'data', 'clips', 'macarena.json'));

  const server = createServer({ workspace });
  client = new Client({ name: 'tools-test', version: '0.0.0' });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  close = async () => {
    await client.close();
    await server.close();
  };
});

afterAll(async () => {
  await close?.();
  await rm(workspace, { recursive: true, force: true });
});

/** Each tool once with valid input and once with invalid input (Requirement 3.1). */
const CASES: { name: string; valid: Record<string, unknown>; invalid: Record<string, unknown> }[] = [
  {
    name: 'notate_clip',
    valid: { clipPath: 'data/clips/macarena.json', tempo: 100, beatsPerBar: 4, grid: 0.5 },
    invalid: { tempo: 100 },
  },
  { name: 'validate_score', valid: { score: SCORE }, invalid: { score: { title: 'no symbols' } } },
  { name: 'describe_score', valid: { score: SCORE }, invalid: { score: 'not a score' } },
  { name: 'mirror_score', valid: { score: SCORE }, invalid: {} },
  { name: 'retime_score', valid: { score: SCORE, factor: 2 }, invalid: { score: SCORE, factor: 0 } },
  { name: 'find_phrase', valid: { score: SCORE, phrase: SCORE }, invalid: { score: SCORE } },
  { name: 'perform_score', valid: { score: SCORE, fps: 10 }, invalid: { score: SCORE, fps: 0 } },
  { name: 'render_score_svg', valid: { score: SCORE }, invalid: { score: SCORE, outPath: 42 } },
  {
    name: 'compose_score',
    valid: { title: 'Phrase', tempo: 100, beatsPerBar: 4, grid: 1, moves: VALID_MOVES },
    invalid: { title: 'Phrase', tempo: 100, beatsPerBar: 4, grid: 1, moves: [{ count: 0, column: 'left-leg' }] },
  },
];

describe('MCP tools, in process (Requirement 3.1)', () => {
  it('lists the nine tools, each with a description and an object input schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOL_NAMES);
    for (const tool of tools) {
      expect(tool.description?.trim().length ?? 0).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it.each(CASES)('$name returns a result without error for valid input', async ({ name, valid }) => {
    const result = await client.callTool({ name, arguments: valid });
    expect(textOf(result).length).toBeGreaterThan(0);
    expect(result.isError ?? false).toBe(false);
  });

  it.each(CASES)('$name returns an error result, and does not throw, for invalid input (Requirement 1.2)', async ({
    name,
    invalid,
  }) => {
    const result = await client.callTool({ name, arguments: invalid });
    expect(result.isError).toBe(true);
    expect(textOf(result).trim().length).toBeGreaterThan(0);
  });

  it('lists every problem in a schema error, not only the first', async () => {
    const result = await client.callTool({
      name: 'notate_clip',
      arguments: { tempo: -1, beatsPerBar: 0, grid: 1 },
    });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('tempo');
    expect(text).toContain('beatsPerBar');
    expect(text).toMatch(/clipPath|frames/);
  });

  it('reports semantic problems of a score through validate_score as ok: false', async () => {
    const bad = { ...SCORE, symbols: [{ ...SCORE.symbols[0], direction: 'place', level: 'middle' }] };
    const result = await client.callTool({ name: 'validate_score', arguments: { score: bad } });
    expect(result.isError ?? false).toBe(false);
    expect(JSON.parse(textOf(result))).toMatchObject({ ok: false });
  });

  it('rejects a turn sign in an arm column with the rule named', async () => {
    const result = await client.callTool({
      name: 'compose_score',
      arguments: {
        title: 'Bad turn',
        tempo: 100,
        beatsPerBar: 4,
        grid: 1,
        moves: [{ count: 1, column: 'left-arm', turn: 'cw', amount: 0.5, counts: 1 }],
      },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('a turn sign must be in a support column');
  });

  it('writes perform_score output to a file inside the workspace', async () => {
    const result = await client.callTool({
      name: 'perform_score',
      arguments: { score: SCORE, fps: 10, outPath: 'out/perform.json' },
    });
    expect(result.isError ?? false).toBe(false);
    await access(join(workspace, 'out', 'perform.json'));
    expect(JSON.parse(await readFile(join(workspace, 'out', 'perform.json'), 'utf8'))).toMatchObject({ fps: 10 });
  });

  it('writes render_score_svg output to a file inside the workspace', async () => {
    const result = await client.callTool({
      name: 'render_score_svg',
      arguments: { score: SCORE, outPath: 'out/score.svg' },
    });
    expect(result.isError ?? false).toBe(false);
    expect(await readFile(join(workspace, 'out', 'score.svg'), 'utf8')).toContain('<svg');
  });

  it('refuses an outPath outside the workspace (Requirement 1.3)', async () => {
    const result = await client.callTool({
      name: 'render_score_svg',
      arguments: { score: SCORE, outPath: '../escaped.svg' },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('outside the workspace');
  });

  it('answers an unknown tool name with an error result', async () => {
    const result = await client.callTool({ name: 'no_such_tool', arguments: {} });
    expect(result.isError).toBe(true);
  });

  it('notate_clip reads a clip through the workspace and returns a valid score', async () => {
    const result = await client.callTool({
      name: 'notate_clip',
      arguments: { clipPath: 'data/clips/macarena.json', tempo: 100, beatsPerBar: 4, grid: 0.5 },
    });
    expect(result.isError ?? false).toBe(false);
    const score = JSON.parse(textOf(result));
    expect(score.symbols.length).toBeGreaterThan(0);
    expect(score.title).toBe('Macarena');
  });

  it('lists the clips as clip:// resources', async () => {
    const { resources } = await client.listResources();
    const macarena = resources.find((r) => r.uri === 'clip://macarena');
    expect(macarena?.name).toBe('Macarena');
    expect(macarena?.description).toContain('subject 143');
  });
});

describe('MCP resources (Requirement 1.4)', () => {
  it('reads clip://macarena as the clip file, unchanged', async () => {
    const { contents } = await client.readResource({ uri: 'clip://macarena' });
    const onDisk = await readFile(join(workspace, 'data', 'clips', 'macarena.json'), 'utf8');
    expect(contents).toHaveLength(1);
    expect(contents[0]?.mimeType).toBe('application/json');
    expect((contents[0] as { text: string }).text).toBe(onDisk);
  });

  it('refuses a resource with another scheme', async () => {
    await expect(client.readResource({ uri: 'file:///etc/passwd' })).rejects.toThrow(/unknown resource/);
  });

  it('refuses a clip that is not in the workspace', async () => {
    await expect(client.readResource({ uri: 'clip://no-such-dance' })).rejects.toThrow(/unknown resource/);
  });
});
