import { ErrorCode, FiddleError } from '../shared/errors';
import { versionFromTag } from './deep-link';
import {
  type FileMap,
  findMainEntry,
  isMainEntry,
  isReservedFileName,
  isSupportedFileName,
  PACKAGE_JSON,
} from './files';
import type { GitHubClient } from './github';
import { type PickedFiles, pickFiddleFiles } from './pick';
import type { FiddleOrigin } from './trust';

export const ELECTRON_OWNER = 'electron';
export const ELECTRON_REPO = 'electron';

export interface DocsExampleOptions {
  /** e.g. `v30.0.0` */
  tag: string;
  /** e.g. `docs/fiddles/quick-start` */
  path: string;
  github: Pick<GitHubClient, 'listRepoDirectory' | 'fetchText'>;
  getTemplate: (version: string) => Promise<FileMap>;
  signal?: AbortSignal;
}

export interface DocsExample extends PickedFiles {
  version: string;
  origin: FiddleOrigin;
}

function assertExamplePath(p: string): void {
  const segments = p.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..' || /[\\\0]/.test(s))) {
    throw new FiddleError(ErrorCode.invalidArgument, `Invalid example path: ${p}`, {
      reason: 'invalid-path',
      path: p,
    });
  }
}

/** Loads `electron/<tag>/<path>`: its files and `package.json` laid over the template for the tag's version. */
export async function loadDocsExample(options: DocsExampleOptions): Promise<DocsExample> {
  const version = versionFromTag(options.tag);
  if (!version) {
    throw new FiddleError(
      ErrorCode.invalidArgument,
      `Could not determine the Electron version from ${options.tag}`,
      {
        reason: 'invalid-tag',
        tag: options.tag,
      },
    );
  }
  assertExamplePath(options.path);

  const entries = await options.github.listRepoDirectory(
    ELECTRON_OWNER,
    ELECTRON_REPO,
    options.path,
    options.tag,
    options.signal,
  );
  const wanted = entries.filter(
    (e) =>
      e.type === 'file' &&
      e.downloadUrl &&
      (e.name === PACKAGE_JSON ||
        (isSupportedFileName(e.name) && !isReservedFileName(e.name))),
  );
  if (!wanted.some((e) => e.name !== PACKAGE_JSON)) {
    throw new FiddleError(
      ErrorCode.invalidArgument,
      `${options.path} has no supported files`,
      {
        reason: 'no-supported-files',
        path: options.path,
      },
    );
  }
  const [template, fetched] = await Promise.all([
    options.getTemplate(version),
    Promise.all(
      wanted.map(
        async (e) =>
          [
            e.name,
            await options.github.fetchText(e.downloadUrl!, options.signal),
          ] as const,
      ),
    ),
  ]);

  const example: FileMap = Object.fromEntries(fetched);
  // The example's main entry replaces the template's, which may have another extension.
  const base = findMainEntry(Object.keys(example))
    ? Object.fromEntries(Object.entries(template).filter(([name]) => !isMainEntry(name)))
    : template;
  return {
    ...pickFiddleFiles({ ...base, ...example }),
    version,
    origin: { kind: 'electron', tag: options.tag, path: options.path },
  };
}
