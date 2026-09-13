/**
 * Loading, creating and saving fiddles without a window, so the headless CLI
 * can reuse them. Everything that needs the user (confirmations) is passed in.
 * No Electron imports.
 */
import * as path from 'node:path';

import { loadDocsExample } from '../../fiddle/docs-examples';
import { findExample, loadExample } from '../../fiddle/examples';
import { createFiddle, type Fiddle, type VersionRef } from '../../fiddle/fiddle';
import { findMainEntry, PACKAGE_JSON, type FileMap } from '../../fiddle/files';
import { readFiddleFolder, writeFiddleFolder } from '../../fiddle/folder';
import { forgeTransform, type ForgeTransformOptions } from '../../fiddle/forge';
import type { GistLoadResult, GitHubClient } from '../../fiddle/github';
import { getProjectName } from '../../fiddle/names';
import {
  generatePackageJson,
  parsePackageJson,
  type ParsedPackageJson,
  type RejectedModule,
} from '../../fiddle/package-json';
import { pickFiddleFiles } from '../../fiddle/pick';
import type { TemplateLoader } from '../../fiddle/templates';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { DEFAULT_TEMPLATE, TEST_TEMPLATE } from './model';

/** What a load keeps from the fiddle it replaces. */
export interface LoadContext {
  version: VersionRef;
  modules: Readonly<Record<string, string>>;
}

export type LoadWarning =
  | { kind: 'invalid-package-json' }
  | { kind: 'unusable-version'; version: string }
  | { kind: 'rejected-modules'; modules: RejectedModule[] };

export interface LoadedFiddle {
  fiddle: Fiddle;
  name: string;
  warnings: LoadWarning[];
  /** A gist's owner login, for display. */
  gistOwner?: string;
}

function releaseVersion(ref: VersionRef): string | undefined {
  return ref.kind === 'release' ? ref.version : undefined;
}

export async function newFiddle(templates: TemplateLoader, version: VersionRef): Promise<LoadedFiddle> {
  const files = await templates.getTemplate(releaseVersion(version));
  return {
    fiddle: createFiddle({ files, version, templateName: DEFAULT_TEMPLATE }),
    name: getProjectName(),
    warnings: [],
  };
}

export async function newTest(templates: TemplateLoader, version: VersionRef): Promise<LoadedFiddle> {
  const files = await templates.getTestTemplate();
  return {
    fiddle: createFiddle({ files, version, templateName: TEST_TEMPLATE }),
    name: getProjectName(),
    warnings: [],
  };
}

export async function loadShowMe(staticDir: string, name: string, context: LoadContext): Promise<LoadedFiddle> {
  const example = findExample(name);
  if (!example) throw new FiddleError(ErrorCode.notFound, `No example named "${name}"`, { name });
  const files = await loadExample(staticDir, example.name);
  return {
    fiddle: createFiddle({
      files,
      version: context.version,
      origin: { kind: 'example' },
      templateName: example.name,
    }),
    name: example.name,
    warnings: [],
  };
}

/**
 * Applies a loaded `package.json` (§17.4): its modules replace the current
 * ones, and a usable Electron version replaces the current version. Without a
 * `package.json` the current modules and version are kept.
 */
export function applyPackageJson(
  context: LoadContext,
  pkg: ParsedPackageJson | undefined,
  isUsableVersion: (version: string) => boolean,
): { version: VersionRef; modules: Record<string, string>; warnings: LoadWarning[] } {
  const warnings: LoadWarning[] = [];
  if (!pkg) return { version: context.version, modules: { ...context.modules }, warnings };
  let version = context.version;
  if (pkg.electronVersion) {
    if (isUsableVersion(pkg.electronVersion)) version = { kind: 'release', version: pkg.electronVersion };
    else warnings.push({ kind: 'unusable-version', version: pkg.electronVersion });
  } else if (pkg.invalidElectronVersion) {
    warnings.push({ kind: 'unusable-version', version: pkg.invalidElectronVersion });
  }
  if (pkg.rejectedModules.length > 0) warnings.push({ kind: 'rejected-modules', modules: pkg.rejectedModules });
  return { version, modules: pkg.modules, warnings };
}

/** Opens a local folder. Only semver validity is checked for its Electron version. */
export async function loadFolder(dir: string, context: LoadContext): Promise<LoadedFiddle> {
  const read = await readFiddleFolder(dir);
  const applied = applyPackageJson(context, read.packageJson, () => true);
  const warnings = read.packageJsonError ? [{ kind: 'invalid-package-json' } as const, ...applied.warnings] : applied.warnings;
  return {
    fiddle: createFiddle({
      files: read.files,
      version: applied.version,
      modules: applied.modules,
      source: { localPath: dir },
    }),
    name: getProjectName(dir),
    warnings,
  };
}

export interface GistRulesOptions {
  context: LoadContext;
  /** Asked for each supported file that fiddles don't usually contain. */
  confirmAddFile: (name: string) => Promise<boolean>;
  /** False for versions that are unreleased or can't run here. Default: any. */
  isUsableVersion?: (version: string) => boolean;
}

/**
 * Turns a loaded gist into a fiddle (§17.4): unsupported files are skipped,
 * unknown supported files are added only if the user agrees, and a gist with
 * no supported files is an error (`pickFiddleFiles` throws `no-supported-files`).
 */
export async function fiddleFromGist(gist: GistLoadResult, options: GistRulesOptions): Promise<LoadedFiddle> {
  const picked = pickFiddleFiles(gist.files, { previousModules: options.context.modules });
  const declined = new Set<string>();
  for (const name of picked.unknown) if (!(await options.confirmAddFile(name))) declined.add(name);

  const warnings: LoadWarning[] = picked.packageJsonError ? [{ kind: 'invalid-package-json' }] : [];
  const applied = applyPackageJson(options.context, picked.packageJson, options.isUsableVersion ?? (() => true));

  return {
    fiddle: createFiddle({
      files: Object.fromEntries(Object.entries(picked.files).filter(([name]) => !declined.has(name))),
      version: applied.version,
      modules: applied.modules,
      origin: gist.origin,
      source: { gistId: gist.id, gistRevision: gist.revision },
    }),
    name: getProjectName(),
    warnings: [...warnings, ...applied.warnings],
    ...(gist.owner ? { gistOwner: gist.owner } : {}),
  };
}

export async function loadGist(
  github: Pick<GitHubClient, 'loadGist'>,
  id: string,
  revision: string | undefined,
  options: GistRulesOptions,
  signal?: AbortSignal,
): Promise<LoadedFiddle & { gist: GistLoadResult }> {
  const gist = await github.loadGist(id, revision, signal);
  return { ...(await fiddleFromGist(gist, options)), gist };
}

/** Dependencies from a gist's `package.json`, for the deep-link confirmation. */
export function gistDependencies(gist: GistLoadResult): Record<string, string> {
  const text = gist.files[PACKAGE_JSON];
  if (text === undefined) return {};
  try {
    return parsePackageJson(text).modules;
  } catch {
    return {};
  }
}

export async function loadElectronExample(
  github: Pick<GitHubClient, 'listRepoDirectory' | 'fetchText'>,
  templates: TemplateLoader,
  tag: string,
  examplePath: string,
  signal?: AbortSignal,
): Promise<LoadedFiddle> {
  const example = await loadDocsExample({
    tag,
    path: examplePath,
    github,
    getTemplate: (version) => templates.getTemplate(version),
    signal,
  });
  return {
    fiddle: createFiddle({
      files: example.files,
      version: { kind: 'release', version: example.version },
      origin: example.origin,
    }),
    name: path.posix.basename(examplePath),
    warnings: [],
  };
}

export interface SaveOptions {
  name: string;
  author?: string;
  /** Set for "Save as Forge project". */
  forge?: ForgeTransformOptions;
}

/** The files written on save: the fiddle, a generated `package.json`, and Forge config if asked. */
export function filesForSave(fiddle: Fiddle, options: SaveOptions): FileMap {
  const packageJson = generatePackageJson({
    name: options.name,
    main: findMainEntry(Object.keys(fiddle.files)),
    author: options.author,
    modules: fiddle.modules,
    electronVersion: releaseVersion(fiddle.version),
  });
  const files = { ...fiddle.files, [PACKAGE_JSON]: packageJson };
  return options.forge ? forgeTransform(files, options.forge) : files;
}

export async function saveToFolder(dir: string, fiddle: Fiddle, options: SaveOptions): Promise<void> {
  await writeFiddleFolder(dir, filesForSave(fiddle, options));
}
