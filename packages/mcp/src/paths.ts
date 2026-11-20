import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/** Thrown when a path points outside the workspace. */
export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

/** True when `target` is `root` or lies under it. Both paths must be absolute and normalised. */
function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  if (rel === '') return true;
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Turns a path given by a tool call into an absolute path inside the workspace (Requirement 1.3). A relative path is
 * taken from the workspace root. The check is lexical, and it also resolves symbolic links of the nearest existing
 * ancestor, so a link inside the workspace cannot lead outside it.
 * @param workspace The workspace root directory.
 * @param p A relative or absolute path.
 * @returns The resolved absolute path.
 * @throws WorkspaceError when the path is outside the workspace.
 */
export function resolveInWorkspace(workspace: string, p: string): string {
  const root = resolve(workspace);
  const target = resolve(root, p);
  if (!isInside(root, target)) {
    throw new WorkspaceError(`path "${p}" is outside the workspace ${root}`);
  }

  let existing = target;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  const realRoot = realpathSync(root);
  if (!isInside(realRoot, realpathSync(existing))) {
    throw new WorkspaceError(`path "${p}" leads outside the workspace ${root} through a link`);
  }
  return target;
}
