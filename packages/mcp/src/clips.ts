import { readFile, readdir } from 'node:fs/promises';
import type { Frame, JointName } from '@danse/core';
import { resolveInWorkspace } from './paths';

/** Directory of clip files, relative to the workspace root. */
export const CLIPS_DIR = 'data/clips';

/** The clip file format written by the CMU import (see `data/clips/*.json`). */
export type ClipFile = {
  id: string;
  title: string;
  source?: Record<string, unknown>;
  fps: number;
  joints: JointName[];
  /** Per frame, per joint in `joints` order, `[x, y, z]` in metres. */
  frames: number[][][];
};

export type ClipSummary = {
  id: string;
  title: string;
  source: ClipFile['source'];
  /** Path relative to the workspace root, with forward slashes. */
  path: string;
};

/**
 * Reads one clip file inside the workspace and checks its shape.
 * @param workspace The workspace root.
 * @param clipPath A path relative to the workspace root, or an absolute path inside it.
 * @returns The parsed clip.
 * @throws WorkspaceError when the path is outside the workspace; Error when the file is not a clip.
 */
export async function readClipFile(workspace: string, clipPath: string): Promise<ClipFile> {
  const file = resolveInWorkspace(workspace, clipPath);
  const clip = JSON.parse(await readFile(file, 'utf8')) as Partial<ClipFile>;
  if (typeof clip.id !== 'string' || typeof clip.title !== 'string') {
    throw new Error(`${clipPath}: a clip needs string fields "id" and "title"`);
  }
  if (!(typeof clip.fps === 'number' && clip.fps > 0)) throw new Error(`${clipPath}: "fps" must be a positive number`);
  if (!Array.isArray(clip.joints) || !Array.isArray(clip.frames)) {
    throw new Error(`${clipPath}: "joints" and "frames" must be arrays`);
  }
  return clip as ClipFile;
}

/**
 * Lists the clips in `data/clips/` (Requirement 1.4). `index.json` is not a clip and is skipped. A missing directory
 * gives an empty list.
 * @param workspace The workspace root.
 */
export async function listClips(workspace: string): Promise<ClipSummary[]> {
  let names: string[];
  try {
    names = await readdir(resolveInWorkspace(workspace, CLIPS_DIR));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const summaries: ClipSummary[] = [];
  for (const name of names.filter((n) => n.endsWith('.json') && n !== 'index.json').sort()) {
    const path = `${CLIPS_DIR}/${name}`;
    const clip = await readClipFile(workspace, path);
    summaries.push({ id: clip.id, title: clip.title, source: clip.source, path });
  }
  return summaries;
}

/**
 * Reads a clip file and returns its frames for notation. Frame `k` has time `k / fps`.
 * @param workspace The workspace root.
 * @param clipPath A path relative to the workspace root.
 * @throws Error when a frame does not have one `[x, y, z]` triple per joint.
 */
export async function readClipFrames(workspace: string, clipPath: string): Promise<Frame[]> {
  const clip = await readClipFile(workspace, clipPath);
  return clip.frames.map((row, k) => {
    if (row.length !== clip.joints.length) {
      throw new Error(`${clipPath}: frame ${k} has ${row.length} joints, expected ${clip.joints.length}`);
    }
    const joints = {} as Frame['joints'];
    clip.joints.forEach((name, j) => {
      const v = row[j] ?? [];
      joints[name] = { x: v[0] ?? 0, y: v[1] ?? 0, z: v[2] ?? 0 };
    });
    return { t: k / clip.fps, joints };
  });
}
