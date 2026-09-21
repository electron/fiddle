#!/usr/bin/env node
// `yarn workspace electron-fiddle driver:build`: builds main, preload and
// renderer in Vite mode `test` (which defines `__FIDDLE_TEST_BUILD__`) into out/test-build.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'vite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const testBuildDir = path.join(appDir, 'out', 'test-build');

const isCode = (error: unknown, ...codes: string[]) =>
  codes.includes((error as NodeJS.ErrnoException).code ?? '');

export async function buildTestApp(): Promise<string> {
  const started = Date.now();
  const staging = `${testBuildDir}.tmp-${process.pid}`;
  const old = `${testBuildDir}.old-${process.pid}`;
  await fs.rm(staging, { recursive: true, force: true });
  try {
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
    const pkg = JSON.parse(
      await fs.readFile(path.join(appDir, 'package.json'), 'utf8'),
    ) as {
      name: string;
      productName: string;
      version: string;
    };
    await fs.writeFile(
      path.join(staging, 'package.json'),
      `${JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, main: 'build/main.cjs' }, null, 2)}\n`,
    );
    // Main reads app-root folders through app.getAppPath() (static/ templates and
    // examples, assets/ icons, native/ helpers), so the test build's app dir links to the real ones.
    for (const dir of ['static', 'assets', 'native']) {
      const target = path.join(appDir, dir);
      const link = path.join(staging, dir);
      await fs
        .symlink(target, link, 'junction')
        .catch(() => fs.cp(target, link, { recursive: true }));
    }
    await fs.rename(testBuildDir, old).catch((error: unknown) => {
      if (!isCode(error, 'ENOENT')) throw error;
    });
    await fs.rename(staging, testBuildDir).catch(async (error: unknown) => {
      // A concurrent build installed its tree first: keep it. Windows reports
      // that as EPERM or EACCES, which only counts when the directory is there.
      if (isCode(error, 'ENOTEMPTY', 'EEXIST')) return;
      const exists = await fs.access(testBuildDir).then(
        () => true,
        () => false,
      );
      if (!(isCode(error, 'EPERM', 'EACCES') && exists)) throw error;
    });
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
    await fs.rm(old, { recursive: true, force: true });
  }
  console.error(
    `[driver] test build ready in ${Date.now() - started} ms: ${testBuildDir}`,
  );
  return testBuildDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildTestApp();
}
