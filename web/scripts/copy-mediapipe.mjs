// Copy MediaPipe's WebAssembly runtime next to the app, so pose reading works without a CDN.
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const pkg = join(import.meta.dirname, "..", "node_modules", "@mediapipe", "tasks-vision");
const out = join(import.meta.dirname, "..", "public", "mediapipe");
mkdirSync(out, { recursive: true });
cpSync(join(pkg, "wasm"), out, { recursive: true });
console.log(`MediaPipe wasm copied to ${out}`);
