import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { validateScore, type Score } from '@danse/core';
import { resolveInWorkspace } from '../paths';
import { errorResult, type ToolResult } from '../result';
import type { ToolContext } from '../tool';

/** The problems of a score, each prefixed with the argument name. An empty list means the score is valid. */
export function scoreErrors(score: Score, label: string): string[] {
  const check = validateScore(score);
  return check.ok ? [] : check.errors.map((e) => `${label}: ${e}`);
}

/**
 * Returns an error result when a score breaks a rule of `validateScore`, or null when it is valid. Tools other than
 * `validate_score` refuse invalid scores this way.
 * @param score A score that already passed the shape check.
 * @param label The name of the argument, used as a prefix on each message.
 */
export function invalidScore(score: Score, label: string): ToolResult | null {
  const errors = scoreErrors(score, label);
  return errors.length > 0 ? errorResult(errors) : null;
}

/**
 * Writes text to a file inside the workspace and creates its parent directories.
 * @returns The path relative to the workspace root, with forward slashes.
 * @throws WorkspaceError when the path is outside the workspace.
 */
export async function writeInWorkspace(ctx: ToolContext, outPath: string, text: string): Promise<string> {
  const file = resolveInWorkspace(ctx.workspace, outPath);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text, 'utf8');
  return relative(resolve(ctx.workspace), file).split(sep).join('/');
}
