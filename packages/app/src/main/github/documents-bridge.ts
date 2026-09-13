/**
 * What the gist flows need from the Documents slice. The service takes this
 * as an interface, so tests pass a fake; `createDocumentsBridge` maps it onto
 * Documents' main-side exports.
 */
import type { VersionRef } from '../../fiddle/fiddle';
import type { FileMap } from '../../fiddle/files';
import { getFiddle, getFiddleFiles, getTemplate, markGistDeleted, markPublished } from '../documents/service';
import type { StateHub } from '../state-hub';

export interface GistFiddle {
  /** Every file's text from the editor mirror, hidden files included. */
  files: FileMap;
  name: string;
  versionRef: VersionRef;
  modules: Readonly<Record<string, string>>;
  source: { gistId?: string; gistRevision?: string };
}

interface GistSaved {
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
    getTemplate: (windowId) => getTemplate(getFiddle(windowId).version),
    markGistSaved: (windowId, gist) => {
      markPublished(windowId, { id: gist.id, revision: gist.revision, owner: gist.owner });
    },
    markGistDeleted: (windowId) => {
      markGistDeleted(windowId);
    },
  };
}
