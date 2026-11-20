import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveInWorkspace, WorkspaceError } from '../src/paths';

let root: string;
let outside: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'danse-ws-'));
  outside = await mkdtemp(join(tmpdir(), 'danse-out-'));
  await mkdir(join(root, 'examples'), { recursive: true });
  await writeFile(join(outside, 'secret.json'), '{}');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe('resolveInWorkspace', () => {
  it('resolves a relative path inside the workspace', () => {
    expect(resolveInWorkspace(root, 'examples/a.json')).toBe(resolve(root, 'examples', 'a.json'));
  });

  it('accepts an absolute path inside the workspace', () => {
    const inside = join(root, 'examples', 'b.svg');
    expect(resolveInWorkspace(root, inside)).toBe(resolve(inside));
  });

  it('rejects a relative path that climbs out with ..', () => {
    expect(() => resolveInWorkspace(root, '../etc/passwd')).toThrow(WorkspaceError);
    expect(() => resolveInWorkspace(root, 'examples/../../x.json')).toThrow(WorkspaceError);
  });

  it('rejects an absolute path outside the workspace', () => {
    expect(() => resolveInWorkspace(root, join(outside, 'secret.json'))).toThrow(WorkspaceError);
  });

  it('rejects a symbolic link inside the workspace that points outside it', async () => {
    const link = join(root, 'examples', 'escape');
    try {
      await symlink(outside, link, 'junction');
    } catch {
      return; // symlinks not permitted on this machine; the lexical checks above still apply
    }
    expect(() => resolveInWorkspace(root, 'examples/escape/secret.json')).toThrow(WorkspaceError);
  });
});
