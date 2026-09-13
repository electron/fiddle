import * as semver from 'semver';

import { ErrorCode, FiddleError } from '../shared/errors';
import { DEFAULT_MAIN_ENTRY } from './files';
import { checkModuleSpec, type ModuleSpecProblem } from './modules';

export type ElectronPackageName = 'electron' | 'electron-nightly';

export interface PackageJsonInput {
  name: string;
  /** The main entry file. Default `main.js`. */
  main?: string;
  author?: string;
  /** Becomes `dependencies`. Omitted when undefined. */
  modules?: Readonly<Record<string, string>>;
  /** Becomes `devDependencies.electron` (or `electron-nightly`). Omitted when undefined. */
  electronVersion?: string;
}

export interface RejectedModule {
  name: string;
  spec: string;
  reason: ModuleSpecProblem;
}

export interface ParsedPackageJson {
  /** `dependencies` and `devDependencies`, without Electron and without rejected specs. */
  modules: Record<string, string>;
  rejectedModules: RejectedModule[];
  /** From an `electron`/`electron-nightly` dependency, range prefix stripped, when it's valid semver. */
  electronVersion?: string;
  /** The stripped Electron version when it isn't valid semver. The caller keeps the current version and warns. */
  invalidElectronVersion?: string;
}

export function electronPackageName(version: string): ElectronPackageName {
  return version.includes('nightly') ? 'electron-nightly' : 'electron';
}

export function generatePackageJson(input: PackageJsonInput): string {
  const pkg: Record<string, unknown> = {
    name: input.name,
    productName: input.name,
    version: '1.0.0',
    main: `./${input.main ?? DEFAULT_MAIN_ENTRY}`,
  };
  if (input.author !== undefined) pkg.author = input.author;
  pkg.scripts = { start: 'electron .' };
  if (input.modules) pkg.dependencies = Object.fromEntries(Object.entries(input.modules));
  if (input.electronVersion) {
    pkg.devDependencies = Object.fromEntries([[electronPackageName(input.electronVersion), input.electronVersion]]);
  }
  return JSON.stringify(pkg, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringEntries(value: unknown): [string, string][] {
  if (!isRecord(value)) return [];
  return Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string');
}

/** Strips range prefixes: `^1.2.0` → `1.2.0`, `~2.3.4` → `2.3.4`. */
export function stripRangePrefix(spec: string): string {
  const digit = spec.search(/\d/);
  return digit < 0 ? spec : spec.slice(digit);
}

/** Reads modules and the Electron version from a loaded `package.json`. Throws on invalid JSON. */
export function parsePackageJson(text: string): ParsedPackageJson {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  if (!isRecord(data)) {
    throw new FiddleError(ErrorCode.invalidArgument, 'Invalid JSON found in package.json', {
      reason: 'invalid-json',
      file: 'package.json',
    });
  }

  const result: ParsedPackageJson = { modules: {}, rejectedModules: [] };
  const modules: [string, string][] = [];
  for (const [name, spec] of [...stringEntries(data.dependencies), ...stringEntries(data.devDependencies)]) {
    if (name === 'electron' || name === 'electron-nightly') {
      const version = stripRangePrefix(spec);
      if (semver.valid(version)) {
        result.electronVersion = semver.valid(version)!;
        delete result.invalidElectronVersion;
      } else {
        result.invalidElectronVersion = version;
      }
      continue;
    }
    const reason = checkModuleSpec(name, spec);
    if (reason) result.rejectedModules.push({ name, spec, reason });
    else modules.push([name, spec]);
  }
  result.modules = Object.fromEntries(modules);
  return result;
}
