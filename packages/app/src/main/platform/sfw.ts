/**
 * Module installs spawn `node sfw.mjs npm|yarn …`, so the `sfw` entry is a file
 * on disk, never bundled: `<resources>/sfw.mjs` when packaged (forge.config.ts).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { app } from 'electron';

import { ErrorCode, FiddleError } from '../../shared/errors';

/** The file name in packaged resources. */
export const SFW_ENTRY = 'sfw.mjs';
/** The entry inside the `sfw` package. */
export const SFW_PACKAGE_ENTRY = 'sfw/dist/sfw.mjs';

export interface SfwLocation {
  packaged: boolean;
  resourcesPath: string;
  /** Resolves a package path from node_modules (dev and test runs). */
  resolve: (id: string) => string;
  exists?: (file: string) => boolean;
}

/** Where `sfw.mjs` is, or undefined when it's missing. */
export function resolveSfwEntry({
  packaged,
  resourcesPath,
  resolve,
  exists = fs.existsSync,
}: SfwLocation): string | undefined {
  let file: string | undefined;
  if (packaged) {
    file = path.join(resourcesPath, SFW_ENTRY);
  } else {
    try {
      file = resolve(SFW_PACKAGE_ENTRY);
    } catch {
      file = undefined;
    }
  }
  return file !== undefined && exists(file) ? file : undefined;
}

let cached: { path: string | undefined } | undefined;

/** `sfw.mjs` for this build, or undefined when it's missing. */
export function sfwEntryPath(): string | undefined {
  cached ??= {
    path: resolveSfwEntry({
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      resolve: createRequire(import.meta.url).resolve,
    }),
  };
  return cached.path;
}

/**
 * `sfw.mjs` to wrap an install with, or undefined when Socket Firewall is off.
 * Throws when it's on but the script is missing: nothing installs unprotected.
 */
export function sfwPathFor(enabled: boolean, find = sfwEntryPath): string | undefined {
  if (!enabled) return undefined;
  const file = find();
  if (!file)
    throw new FiddleError(
      ErrorCode.unavailable,
      "Socket Firewall isn't available, so packages can't be installed.",
    );
  return file;
}
