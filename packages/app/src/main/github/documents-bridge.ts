/**
 * What the gist flows need from the Documents slice. The service takes this
 * as an interface, so tests pass a fake; `createDocumentsBridge` maps it onto
 * Documents' main-side exports.
 */
import path from 'node:path';

import * as semver from 'semver';

import type { VersionRef } from '../../fiddle/fiddle';
import type { FileMap } from '../../fiddle/files';
import { createTemplateLoader, type TemplateLoader } from '../../fiddle/templates';
import { getFiddle, getFiddleFiles, markGistDeleted, markPublished, staticDir } from '../documents/service';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import { getCacheRoot, getEndpoints } from '../test-mode';

export interface GistFiddle {
  /** Every file's text from the editor mirror, hidden files included. */
  files: FileMap;
  name: string;
  versionRef: VersionRef;
  modules: Readonly<Record<string, string>>;
  source: { gistId?: string; gistRevision?: string };
}

export interface GistSaved {
  id: string;
  owner: string | null;
  revision: string | undefined;
}

export interface GistDocuments {
  getFiddle(windowId: string): Promise<GistFiddle>;
  /** The default template for the window's Electron version (for "publish as revision"). */
  getTemplate(windowId: string): Promise<FileMap>;
  /** Published or updated: link the gist, unlink the local folder, reset the saved baseline. */
  markGistSaved(windowId: string, gist: GistSaved): void;
  /** Deleted: forget the gist and mark the fiddle unsaved. */
  markGistDeleted(windowId: string): void;
}

export function createDocumentsBridge(hub: StateHub): GistDocuments {
  let templates: TemplateLoader | undefined;
  // Same cache and mirror as Documents' loader, so templates are downloaded once.
  const templateLoader = () =>
    (templates ??= createTemplateLoader({
      staticDir: staticDir(),
      cacheDir: path.join(getCacheRoot(), 'templates'),
      isReleasedMajor: (major) => major <= (semver.parse(process.versions.electron)?.major ?? 0),
      archiveBaseUrl: `${getEndpoints().minimalRepro}/archive`,
      onFallback: (branch, error) => log.warn('template download failed, using the quick-start', branch, error),
    }));

  return {
    getFiddle: async (windowId) => {
      const fiddle = getFiddle(windowId);
      return {
        files: getFiddleFiles(windowId),
        name: hub.getWindow(windowId)?.fiddle.name ?? '',
        versionRef: fiddle.version,
        modules: fiddle.modules,
        source: { gistId: fiddle.source.gistId, gistRevision: fiddle.source.gistRevision },
      };
    },
    getTemplate: (windowId) => {
      const version = getFiddle(windowId).version;
      return templateLoader().getTemplate(version.kind === 'release' ? version.version : undefined);
    },
    markGistSaved: (windowId, gist) => {
      markPublished(windowId, { id: gist.id, revision: gist.revision, owner: gist.owner });
    },
    markGistDeleted: (windowId) => {
      markGistDeleted(windowId);
    },
  };
}
