import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listClips, readClipFrames } from '../src/clips';

const REPO = resolve(import.meta.dirname, '..', '..', '..');
let workspace: string;

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'danse-clips-'));
  const clipDir = join(workspace, 'data', 'clips');
  await mkdir(clipDir, { recursive: true });
  // Copies of two CMU clips from this repository; index.json must not be listed as a clip.
  await copyFile(join(REPO, 'data', 'clips', 'macarena.json'), join(clipDir, 'macarena.json'));
  await copyFile(join(REPO, 'data', 'clips', 'twist.json'), join(clipDir, 'twist.json'));
  await copyFile(join(REPO, 'data', 'clips', 'index.json'), join(clipDir, 'index.json'));
});

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe('listClips (Requirement 1.4)', () => {
  it('lists each clip file once with its id, title and source, and skips index.json', async () => {
    const clips = await listClips(workspace);
    expect(clips.map((c) => c.id).sort()).toEqual(['macarena', 'twist']);
    const macarena = clips.find((c) => c.id === 'macarena');
    expect(macarena?.title).toBe('Macarena');
    expect(macarena?.source).toMatchObject({ subject: '143', trial: '35' });
    expect(macarena?.path).toBe('data/clips/macarena.json');
  });

  it('returns an empty list when the workspace has no clip directory', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'danse-empty-'));
    try {
      expect(await listClips(empty)).toEqual([]);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});

describe('readClipFrames', () => {
  it('returns frames at the clip fps with all 15 joints in metres', async () => {
    const frames = await readClipFrames(workspace, 'data/clips/macarena.json');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[1]?.t).toBeCloseTo(1 / 30, 6);
    expect(Object.keys(frames[0]?.joints ?? {})).toHaveLength(15);
  });

  it('refuses a clip path outside the workspace', async () => {
    await expect(readClipFrames(workspace, '../../macarena.json')).rejects.toThrow(/outside the workspace/);
  });

  it.each([
    ['a clip without a title', { id: 'x', fps: 30, joints: [], frames: [] }, /"id" and "title"/],
    ['a clip with fps 0', { id: 'x', title: 'X', fps: 0, joints: [], frames: [] }, /"fps" must be a positive number/],
    ['a clip whose frames are not an array', { id: 'x', title: 'X', fps: 30, joints: [], frames: {} }, /must be arrays/],
    [
      'a frame with fewer joints than the clip names',
      { id: 'x', title: 'X', fps: 30, joints: ['pelvis', 'head'], frames: [[[0, 1, 0]]] },
      /frame 0 has 1 joints, expected 2/,
    ],
  ])('refuses %s', async (_name, clip, message) => {
    const file = join(workspace, 'data', 'clips', 'broken.json');
    await writeFile(file, JSON.stringify(clip));
    try {
      await expect(readClipFrames(workspace, 'data/clips/broken.json')).rejects.toThrow(message);
    } finally {
      await rm(file);
    }
  });
});
