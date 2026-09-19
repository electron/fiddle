import { ErrorCode, FiddleError } from '../shared/errors';
import { reasonError } from './error-reasons';
import {
  ensureMainEntry,
  type FileMap,
  hasName,
  isKnownFile,
  isReservedFileName,
  isSupportedFileName,
  PACKAGE_JSON,
} from './files';
import { type ParsedPackageJson, parsePackageJson } from './package-json';

export interface PickedFiles {
  /** Supported files, `unknown` included, with a main entry added if missing. */
  files: FileMap;
  packageJson?: ParsedPackageJson;
  /** Set when `package.json` is invalid. The files still load. */
  packageJsonError?: FiddleError;
  /** Names left out: unsupported, reserved, or a case-only duplicate of an earlier name. */
  skipped: string[];
  /** Supported names outside `KNOWN_FILES`. They're in `files`; ask the user before keeping them. */
  unknown: string[];
  /** `package.json`'s modules, or `previousModules` when there's no valid `package.json`. */
  modules: Record<string, string>;
}

export interface PickOptions {
  /** Kept when there's no valid `package.json`, as for gists. Default: none. */
  previousModules?: Readonly<Record<string, string>>;
}

/**
 * Turns a loaded folder, gist, template or docs example (every file it has)
 * into a fiddle's files. Throws `no-supported-files` if nothing is left.
 */
export function pickFiddleFiles(map: FileMap, options: PickOptions = {}): PickedFiles {
  const kept: string[] = [];
  const skipped: string[] = [];
  let packageJsonText: string | undefined;
  for (const name of Object.keys(map)) {
    if (name === PACKAGE_JSON) packageJsonText = map[name];
    else if (
      !isSupportedFileName(name) ||
      isReservedFileName(name) ||
      hasName(kept, name)
    )
      skipped.push(name);
    else kept.push(name);
  }
  if (kept.length === 0) {
    throw reasonError(
      ErrorCode.invalidArgument,
      'no-supported-files',
      'No supported files found',
      { skipped },
    );
  }

  const result: PickedFiles = {
    files: ensureMainEntry(Object.fromEntries(kept.map((name) => [name, map[name]!]))),
    skipped,
    unknown: kept.filter((name) => !isKnownFile(name)),
    modules: { ...options.previousModules },
  };
  if (packageJsonText !== undefined) {
    try {
      result.packageJson = parsePackageJson(packageJsonText);
      result.modules = { ...result.packageJson.modules };
    } catch (error) {
      result.packageJsonError = FiddleError.from(error);
    }
  }
  return result;
}
