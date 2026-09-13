#!/usr/bin/env node
// `yarn workspace electron-fiddle driver:release-check [paths...]`
//
// Fails if test-only code is in a release build (REQUIREMENTS §11). With no
// arguments it builds main and preload in production mode into a temp dir and
// scans them. With paths (files or directories, e.g. a packaged app.asar or
// .vite/), it scans those instead. CI runs it on the packaged app.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

/** Strings that exist only in src/main/test-driver (and renderer test hooks). */
const MARKERS = [
  'ELECTRON_FIDDLE_DRIVER_SOCKET',
  'Accessibility.getFullAXTree',
  'non-loopback request',
  '__fiddleTest',
];

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function* files(target: string): Generator<string> {
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    yield target;
    return;
  }
  for (const entry of fs.readdirSync(target)) yield* files(path.join(target, entry));
}

let targets = process.argv.slice(2);
let temp: string | undefined;
if (targets.length === 0) {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-release-check-'));
  for (const config of ['vite.main.config.mts', 'vite.preload.config.mts']) {
    await build({
      configFile: path.join(appDir, config),
      root: appDir,
      mode: 'production',
      logLevel: 'warn',
      build: { outDir: temp, sourcemap: false },
    });
  }
  targets = [temp];
}

const hits: string[] = [];
let scanned = 0;
for (const target of targets) {
  for (const file of files(target)) {
    if (file.endsWith('.map')) continue;
    scanned++;
    const content = fs.readFileSync(file, 'latin1');
    for (const marker of MARKERS) if (content.includes(marker)) hits.push(`${file}: ${marker}`);
  }
}
if (temp) fs.rmSync(temp, { recursive: true, force: true });

if (hits.length > 0) {
  console.error(`Test-only code found in the release build:\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log(`No test-only code in ${scanned} release file(s).`);
