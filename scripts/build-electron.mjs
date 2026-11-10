import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'dist-electron');
fs.mkdirSync(outDir, { recursive: true });

await Promise.all([
  esbuild.build({
    entryPoints: [path.join(root, 'electron', 'main.ts')],
    outfile: path.join(outDir, 'main.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: false,
    external: ['electron', 'node-hid', 'express', 'vite'],
  }),
  esbuild.build({
    entryPoints: [path.join(root, 'electron', 'preload.ts')],
    outfile: path.join(outDir, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: false,
    external: ['electron'],
  }),
  esbuild.build({
    entryPoints: [path.join(root, 'local-server.ts')],
    outfile: path.join(outDir, 'server.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: false,
    define: { 'import.meta.dirname': '__dirname' },
    external: ['node-hid', 'express', 'vite'],
  }),
  esbuild.build({
    entryPoints: [path.join(root, 'electron', 'hid-worker.ts')],
    outfile: path.join(outDir, 'hid-worker.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: false,
    define: { 'import.meta.dirname': '__dirname' },
    external: ['node-hid'],
  }),
]);

console.log('Built Electron main, preload, worker, and server bundles -> dist-electron/');
