/**
 * Socket Firewall (REQUIREMENTS §2, §4). Module installs run as
 * `node sfw.mjs npm|yarn …` (`buildInstallCommand` in src/fiddle/modules.ts),
 * so the `sfw` package's entry is spawned from disk and never bundled.
 * Packaged builds ship it at `<resources>/sfw.mjs` (forge.config.ts
 * `extraResource`); dev and test runs use it from node_modules.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { app } from 'electron';

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
export function resolveSfwEntry({ packaged, resourcesPath, resolve, exists = fs.existsSync }: SfwLocation): string | undefined {
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
