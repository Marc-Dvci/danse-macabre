#!/usr/bin/env tsx
import { resolve } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server';

// The workspace is DANSE_WORKSPACE, or the current directory. Logs go to stderr: stdout carries the protocol.
const workspace = resolve(process.env.DANSE_WORKSPACE ?? process.cwd());
const server = createServer({ workspace });
await server.connect(new StdioServerTransport());
console.error(`danse-macabre MCP server ready, workspace ${workspace}`);
