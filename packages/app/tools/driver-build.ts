#!/usr/bin/env node
// `yarn workspace electron-fiddle driver:build`: the e2e test build.
//
// Builds main, preload and renderer with the standalone Vite configs in mode
// `test`, which defines `__FIDDLE_TEST_BUILD__` (vite.main.config.mts) and so
// compiles in test mode and the e2e driver (src/main/test-driver). Output goes
// to out/test-build, with its own package.json, and is swapped in atomically so
// a concurrent build never leaves a half-written tree. Release builds and
// `yarn start:xvfb` (.vite/) are untouched.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'vite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const testBuildDir = path.join(appDir, 'out', 'test-build');

export async function buildTestApp(): Promise<string> {
  const started = Date.now();
  const staging = `${testBuildDir}.tmp-${process.pid}`;
  await fs.rm(staging, { recursive: true, force: true });
  for (const [config, outDir] of [
    ['vite.main.config.mts', 'build'],
    ['vite.preload.config.mts', 'build'],
    ['vite.renderer.config.mts', 'renderer/main_window'],
  ] as const) {
    await build({
      configFile: path.join(appDir, config),
      root: appDir,
      mode: 'test',
      logLevel: 'warn',
      build: { outDir: path.join(staging, outDir) },
    });
  }
  const pkg = JSON.parse(await fs.readFile(path.join(appDir, 'package.json'), 'utf8')) as {
    name: string;
    productName: string;
    version: string;
  };
  await fs.writeFile(
    path.join(staging, 'package.json'),
    `${JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, main: 'build/main.js' }, null, 2)}\n`,
  );
  // Main reads app-root folders through app.getAppPath() (static/ templates and
  // examples, assets/ icons), so the test build's app dir links to the real ones.
  for (const dir of ['static', 'assets']) {
    const target = path.join(appDir, dir);
    const link = path.join(staging, dir);
    await fs.symlink(target, link, 'junction').catch(() => fs.cp(target, link, { recursive: true }));
  }
  const old = `${testBuildDir}.old-${process.pid}`;
  await fs.rename(testBuildDir, old).catch(() => undefined);
  await fs.rename(staging, testBuildDir);
  await fs.rm(old, { recursive: true, force: true });
  console.error(`[driver] test build ready in ${Date.now() - started} ms: ${testBuildDir}`);
  return testBuildDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildTestApp();
}
