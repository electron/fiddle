import type { VersionRef } from '../../fiddle/fiddle';
import type { FileMap } from '../../fiddle/files';
import {
  getDoc,
  getTemplate,
  markGistDeleted,
  markPublished,
} from '../documents/service';
import type { StateHub } from '../state-hub';

export interface GistFiddle {
  /** Hidden files included. */
  files: FileMap;
  name: string;
  versionRef: VersionRef;
  modules: Readonly<Record<string, string>>;
  source: { gistId?: string; gistRevision?: string };
  /** The files the fiddle held when it was loaded or last saved. An update deletes only remote files with these names. */
  savedNames: string[];
  /** Tells `markGistSaved` whether the window still holds the fiddle these files came from. */
  fiddleRev: number;
}

interface GistSaved {
  id: string;
  owner: string | null;
  revision: string | undefined;
}

export interface GistDocuments {
  getFiddle(windowId: string): Promise<GistFiddle>;
  /** For "publish as revision". */
  getTemplate(windowId: string): Promise<FileMap>;
  /**
   * Published or updated: link the gist, unlink the local folder, and make
   * `sent` (what was uploaded, not what the editor holds now) the saved state.
   */
  markGistSaved(
    windowId: string,
    gist: GistSaved,
    sent: Pick<GistFiddle, 'files' | 'modules' | 'fiddleRev'>,
  ): void;
  /** Deleted: forget the gist and mark the fiddle unsaved. */
  markGistDeleted(windowId: string): void;
}

export function createDocumentsBridge(hub: StateHub): GistDocuments {
  return {
    getFiddle: async (windowId) => {
      const { fiddle, baseline, fiddleRev } = getDoc(windowId);
      return {
        files: { ...fiddle.files },
        name: hub.getWindow(windowId)?.fiddle.name ?? '',
        versionRef: fiddle.version,
        modules: fiddle.modules,
        source: {
          gistId: fiddle.source.gistId,
          gistRevision: fiddle.source.gistRevision,
        },
        savedNames: Object.keys(baseline),
        fiddleRev,
      };
    },
    getTemplate: (windowId) => getTemplate(getDoc(windowId).fiddle.version),
    markGistSaved: (windowId, gist, sent) => {
      markPublished(
        windowId,
        { id: gist.id, revision: gist.revision, owner: gist.owner },
        sent,
      );
    },
    markGistDeleted: (windowId) => {
      markGistDeleted(windowId);
    },
  };
}
