import path from 'node:path';

import { app } from 'electron';

import { tm } from '../i18n';

const WEBSITE = 'https://electronjs.org/fiddle';
const CONTRIBUTORS_PAGE = 'https://github.com/electron/fiddle/graphs/contributors';

const contributorFiles = import.meta.glob<unknown>('../../../static/contributors.json', {
  eager: true,
  import: 'default',
});

/** Names from contributors.json: `{ contributors: [...] }` or a bare array. An entry's `name` wins over its `login`. */
export function contributorNames(data: unknown): string[] {
  const list = Array.isArray(data)
    ? data
    : (data as { contributors?: unknown } | null | undefined)?.contributors;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry: unknown) => {
    const { name, login } = (entry ?? {}) as { name?: unknown; login?: unknown };
    const label =
      typeof name === 'string' && name.trim()
        ? name.trim()
        : typeof login === 'string'
          ? login
          : '';
    return label ? [label] : [];
  });
}

export function setupAboutPanel(): void {
  const tp = tm('mainPlatform');
  const names = contributorNames(Object.values(contributorFiles)[0]);
  // Linux only, and read from disk: forge.config.ts ships the file in `extraResource`.
  const icon = app.isPackaged
    ? path.join(process.resourcesPath, 'fiddle.png')
    : path.join(app.getAppPath(), 'assets', 'icons', 'fiddle.png');
  const isMac = process.platform === 'darwin';
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    // macOS shows `version` as the build number, "1.0.0 (44.3.0)"; elsewhere both go in one line.
    applicationVersion: isMac
      ? app.getVersion()
      : tp('aboutVersion', {
          version: app.getVersion(),
          electron: process.versions.electron,
        }),
    version: process.versions.electron,
    copyright: tp('aboutCopyright'),
    // `credits` is macOS-only; `authors` and `website` are Linux-only.
    credits: names.length ? names.join(', ') : CONTRIBUTORS_PAGE,
    authors: names,
    website: WEBSITE,
    iconPath: icon,
  });
}
