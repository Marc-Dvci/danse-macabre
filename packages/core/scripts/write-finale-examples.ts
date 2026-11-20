// Writes examples/danse-macabre.svg and examples/danse-macabre-lesson.txt from examples/danse-macabre.score.json.
// The score is read as stored and checked with validateScore. It is not recomposed.
// Run from the repository root: pnpm exec tsx packages/core/scripts/write-finale-examples.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, renderStaffSvg, validateScore, type Score } from '../src/index';

const score = JSON.parse(readFileSync(resolve('examples', 'danse-macabre.score.json'), 'utf8')) as Score;

const check = validateScore(score);
if (!check.ok) {
  throw new Error(`score is not valid:\n${check.errors.join('\n')}`);
}

const svg = renderStaffSvg(score, { beatHeight: 24, columnWidth: 16 });
const lines = describe(score);
const lessonText = lines.map((l) => l.text).join('\n') + '\n';

writeFileSync(resolve('examples', 'danse-macabre.svg'), svg + '\n', 'utf8');
writeFileSync(resolve('examples', 'danse-macabre-lesson.txt'), lessonText, 'utf8');

console.log(`symbols: ${score.symbols.length}`);
console.log(`turn symbols: ${score.symbols.filter((s) => s.kind === 'turn').length}`);
console.log(`lesson lines: ${lines.length}`);
console.log(`svg bytes: ${svg.length}`);
