import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type Resource,
} from '@modelcontextprotocol/sdk/types.js';
import { listClips, type ClipSummary } from './clips';
import { errorResult } from './result';
import { resolveInWorkspace } from './paths';
import { ALL_TOOLS } from './tools/index';

export const SERVER_NAME = 'danse-macabre';
export const SERVER_VERSION = '1.0.0';
const CLIP_SCHEME = 'clip://';

export type ServerOptions = {
  /** Directory that tools may read and write. Relative paths are taken from here. */
  workspace: string;
};

/** Describes where a clip comes from, for the resource list: database, subject and trial. */
function describeSource(clip: ClipSummary): string {
  const source = clip.source ?? {};
  const database = typeof source.database === 'string' ? source.database : 'clip';
  const subject = source.subject !== undefined ? `, subject ${String(source.subject)}` : '';
  const trial = source.trial !== undefined ? `, trial ${String(source.trial)}` : '';
  return `${database}${subject}${trial}`;
}

/**
 * Builds the MCP server: the tools (Requirement 1.1), argument checks that return error results (1.2), workspace
 * limits (1.3) and the clip resources (1.4). The server uses the low-level `Server` class, so an invalid argument
 * produces an error result with every problem, not a protocol error.
 * @param options Workspace directory.
 * @returns A server that is not yet connected to a transport.
 */
export function createServer(options: ServerOptions): Server {
  const ctx = { workspace: resolve(options.workspace) };
  const toolsByName = new Map(ALL_TOOLS.map((t) => [t.name, t]));

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as { type: 'object'; [key: string]: unknown },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolsByName.get(request.params.name);
    if (!tool) return errorResult([`unknown tool "${request.params.name}"`]);
    return tool.call(request.params.arguments ?? {}, ctx);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const clips = await listClips(ctx.workspace);
    const resources: Resource[] = clips.map((clip) => ({
      uri: `${CLIP_SCHEME}${clip.id}`,
      name: clip.title,
      description: describeSource(clip),
      mimeType: 'application/json',
    }));
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    if (!uri.startsWith(CLIP_SCHEME)) throw new Error(`unknown resource "${uri}"`);
    const id = uri.slice(CLIP_SCHEME.length);
    const clip = (await listClips(ctx.workspace)).find((c) => c.id === id);
    if (!clip) throw new Error(`unknown resource "${uri}"`);
    const text = await readFile(resolveInWorkspace(ctx.workspace, clip.path), 'utf8');
    return { contents: [{ uri, mimeType: 'application/json', text }] };
  });

  return server;
}
