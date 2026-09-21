/**
 * Module installs spawn `node sfw.mjs npm|yarn …`, so `sfw` stays on disk,
 * never bundled. The script reads `../package.json` and downloads its binary
 * into `../.sfw-cache/`, so it has to sit in a writable folder laid out like
 * the package: `node_modules/sfw` in dev and test runs, and in packaged builds
 * a per-user copy of `<resources>/sfw/` (forge.config.ts), because the install
 * directory is read-only on Linux and a signed bundle on macOS.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { app } from 'electron';

import { ErrorCode, FiddleError } from '../../shared/errors';
import { writeAtomic } from '@electron/fiddle-core';

/** The folder in packaged resources and under userData. */
export const SFW_DIR = 'sfw';
/** What the script needs from its package, relative to the package root. */
export const SFW_FILES = ['package.json', path.join('dist', 'sfw.mjs')] as const;
/** The entry inside the `sfw` package. */
export const SFW_PACKAGE_ENTRY = 'sfw/dist/sfw.mjs';

export interface SfwLocation {
  packaged: boolean;
  resourcesPath: string;
  userData: string;
  /** Resolves a package path from node_modules (dev and test runs). */
  resolve: (id: string) => string;
}

/** Where a runnable `sfw.mjs` is, or undefined when the build doesn't have one. */
export async function resolveSfwEntry({
  packaged,
  resourcesPath,
  userData,
  resolve,
}: SfwLocation): Promise<string | undefined> {
  if (!packaged) {
    try {
      const file = resolve(SFW_PACKAGE_ENTRY);
      return fs.existsSync(file) ? file : undefined;
    } catch {
      return undefined;
    }
  }
  const shipped = path.join(resourcesPath, SFW_DIR);
  if (!fs.existsSync(path.join(shipped, SFW_FILES[1]))) return undefined;
  const copy = path.join(userData, SFW_DIR);
  for (const name of SFW_FILES) {
    const data = await fs.promises.readFile(path.join(shipped, name));
    const target = path.join(copy, name);
    const current = await fs.promises.readFile(target).catch(() => undefined);
    if (!current?.equals(data)) await writeAtomic(target, data);
  }
  return path.join(copy, SFW_FILES[1]);
}

let cached: Promise<string | undefined> | undefined;

/** `sfw.mjs` for this build, or undefined when it's missing. A failed copy is retried on the next call. */
export function sfwEntryPath(): Promise<string | undefined> {
  cached ??= resolveSfwEntry({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    userData: app.getPath('userData'),
    resolve: createRequire(import.meta.url).resolve,
  }).catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}

/**
 * `sfw.mjs` to wrap an install with, or undefined when Socket Firewall is off.
 * Throws when it's on but the script is missing: nothing installs unprotected.
 */
export async function sfwPathFor(
  enabled: boolean,
  find: () => Promise<string | undefined> = sfwEntryPath,
): Promise<string | undefined> {
  if (!enabled) return undefined;
  const file = await find();
  if (!file)
    throw new FiddleError(
      ErrorCode.unavailable,
      "Socket Firewall isn't available, so packages can't be installed.",
    );
  return file;
}
