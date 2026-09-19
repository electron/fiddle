#!/usr/bin/env node
// `yarn workspace electron-fiddle driver:release-check [paths...]`: fails if test-only code is in a
// release build (a production build of main, preload and renderer, or the given files or
// directories), or if a marker is missing from a test build, which would leave it guarding nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { MARKERS } from '../../../tools/release-markers.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function* files(target: string): Generator<string> {
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    yield target;
    return;
  }
  for (const entry of fs.readdirSync(target)) yield* files(path.join(target, entry));
}

/** The markers in `targets`, and where each was found. */
function scan(targets: string[]): { found: Map<string, string[]>; scanned: number } {
  const found = new Map<string, string[]>();
  let scanned = 0;
  for (const target of targets) {
    for (const file of files(target)) {
      if (file.endsWith('.map')) continue;
      scanned++;
      const content = fs.readFileSync(file, 'latin1');
      for (const marker of MARKERS) {
        if (content.includes(marker))
          found.set(marker, [...(found.get(marker) ?? []), file]);
      }
    }
  }
  return { found, scanned };
}

async function buildAll(mode: 'production' | 'test', outDir: string): Promise<void> {
  for (const [config, dir] of [
    ['vite.main.config.mts', 'build'],
    ['vite.preload.config.mts', 'build'],
    ['vite.renderer.config.mts', 'renderer'],
  ] as const) {
    await build({
      configFile: path.join(appDir, config),
      root: appDir,
      mode,
      logLevel: 'error',
      build: { outDir: path.join(outDir, dir), sourcemap: false },
    });
  }
}

const problems: string[] = [];
let scanned: number;
const paths = process.argv.slice(2);
if (paths.length > 0) {
  const result = scan(paths);
  scanned = result.scanned;
  for (const [marker, where] of result.found)
    problems.push(`${marker} is in the release build: ${where.join(', ')}`);
} else {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-release-check-'));
  try {
    await buildAll('production', path.join(temp, 'production'));
    const release = scan([path.join(temp, 'production')]);
    scanned = release.scanned;
    for (const [marker, where] of release.found)
      problems.push(`${marker} is in the release build: ${where.join(', ')}`);

    await buildAll('test', path.join(temp, 'test'));
    const { found } = scan([path.join(temp, 'test')]);
    for (const marker of MARKERS)
      if (!found.has(marker)) problems.push(`${marker} is not in a test build`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

if (problems.length > 0) {
  console.error(`Release check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`No test-only code in ${scanned} release file(s).`);
