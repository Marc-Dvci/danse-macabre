// Choreographs the finale through the danse-macabre MCP server. The script starts the server over stdio and makes tool
// calls only: compose_score, validate_score, describe_score, render_score_svg. It then writes the score JSON and the
// lesson text.
//
// Music: the opening waltz of Saint-Saëns, Danse macabre (1874). 3/4 time, 193 beats per minute, 64 bars per minute.
// Layout (16 bars, 48 counts, grid 1 count):
//   - Supports: a waltz box step, two bars per box. Forward (left foot), side (right foot), close (left foot); then
//     backward (right foot), side (left foot), close (right foot). Each step lasts one count.
//   - Turns: a half turn on the close of the backward half of every fourth bar (bars 4, 8, 12, 16), on the right foot.
//   - Arms: on count 1 of each bar, both arms sweep over the bar (3 counts). The sweep cycles through four positions:
//     arms out to the sides, high; arms straight up; arms out to the sides, middle; arms straight up.
//
// Run from the repository root:  node examples/compose-finale.mjs
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES = join(ROOT, 'examples');
const SDK = new URL('../packages/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/', import.meta.url);
const { Client } = await import(new URL('client/index.js', SDK).href);
const { StdioClientTransport } = await import(new URL('client/stdio.js', SDK).href);

const TEMPO = 193;
const BEATS_PER_BAR = 3;
const GRID = 1;
const BARS = 16;

// One box step is six counts. Phase k is the step on count k + 1 within the box.
const BOX_STEPS = [
  { column: 'left-support', direction: 'forward', level: 'middle' },
  { column: 'right-support', direction: 'right', level: 'middle' },
  { column: 'left-support', direction: 'place', level: 'middle' },
  { column: 'right-support', direction: 'backward', level: 'middle' },
  { column: 'left-support', direction: 'left', level: 'middle' },
  { column: 'right-support', direction: 'place', level: 'middle' },
];

// Arm positions, cycled every four bars. Each bar starts with the arms moving to the next position.
const ARM_POSITIONS = [
  [
    { column: 'left-arm', direction: 'left', level: 'high' },
    { column: 'right-arm', direction: 'right', level: 'high' },
  ],
  [
    { column: 'left-arm', direction: 'place', level: 'high' },
    { column: 'right-arm', direction: 'place', level: 'high' },
  ],
  [
    { column: 'left-arm', direction: 'left', level: 'middle' },
    { column: 'right-arm', direction: 'right', level: 'middle' },
  ],
  [
    { column: 'left-arm', direction: 'place', level: 'high' },
    { column: 'right-arm', direction: 'place', level: 'high' },
  ],
];

function buildMoves() {
  const moves = [];
  for (let count = 1; count <= BARS * BEATS_PER_BAR; count++) {
    const phase = (count - 1) % 6;
    if (count % 12 === 0) {
      // Count 12, 24, 36, 48: the close of the backward half of bars 4, 8, 12 and 16 becomes a half turn.
      moves.push({ count, column: 'right-support', turn: 'cw', amount: 0.5, counts: 1 });
    } else {
      moves.push({ count, ...BOX_STEPS[phase], counts: 1 });
    }
  }
  for (let bar = 1; bar <= BARS; bar++) {
    const count = (bar - 1) * BEATS_PER_BAR + 1;
    for (const arm of ARM_POSITIONS[(bar - 1) % 4]) {
      moves.push({ count, ...arm, counts: BEATS_PER_BAR });
    }
  }
  return moves;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', 'tsx', 'packages/mcp/src/bin.ts'],
  cwd: ROOT,
  env: { ...process.env, DANSE_WORKSPACE: ROOT },
  stderr: 'inherit',
});
const client = new Client({ name: 'compose-finale', version: '0.1.0' });
await client.connect(transport);

try {
  const { tools } = await client.listTools();
  console.log(`connected to danse-macabre: ${tools.length} tools`);

  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content[0]?.text ?? '';
    if (result.isError) throw new Error(`${name} failed:\n${text}`);
    return text;
  };

  const moves = buildMoves();
  const startPosition = {
    'left-support': { direction: 'place', level: 'middle' },
    'right-support': { direction: 'place', level: 'middle' },
    'left-arm': { direction: 'place', level: 'low' },
    'right-arm': { direction: 'place', level: 'low' },
  };
  const score = JSON.parse(
    await call('compose_score', {
      title: 'Danse macabre: opening waltz, 16 bars',
      tempo: TEMPO,
      beatsPerBar: BEATS_PER_BAR,
      grid: GRID,
      startPosition,
      moves,
    }),
  );
  console.log(`composed ${score.symbols.length} symbols from ${moves.length} moves`);

  const check = JSON.parse(await call('validate_score', { score }));
  if (!check.ok) throw new Error(`validate_score: ${check.errors.join('; ')}`);
  console.log('validate_score: ok');

  const { lines } = JSON.parse(await call('describe_score', { score }));
  const lessonText = lines.map((line) => line.text).join('\n') + '\n';

  const svgReport = await call('render_score_svg', { score, outPath: 'examples/danse-macabre.svg' });
  console.log(`render_score_svg: ${svgReport.replace(/\s+/g, ' ')}`);

  await writeFile(join(EXAMPLES, 'danse-macabre.score.json'), JSON.stringify(score, null, 1) + '\n');
  await writeFile(join(EXAMPLES, 'danse-macabre-lesson.txt'), lessonText);
  console.log(`lesson: ${lines.length} lines written to examples/danse-macabre-lesson.txt`);
} finally {
  await client.close();
}
