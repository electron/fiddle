/** Binds the `Documents` EIPC interface for one window. Handlers close over `windowId`. */
import { Documents, implement } from '../../ipc/main';
import type { IpcContext } from '../ipc';
import {
  docAddFile,
  docRemoveFile,
  docRenameFile,
  docSetActiveFile,
  docSetFileVisible,
} from './model';
import {
  editFile,
  getFiddleFiles,
  loadDocsExampleIn,
  loadGistIn,
  openDropped,
  setLayout,
  setView,
  showMeIn,
  updateDoc,
} from './service';

export function bindDocumentsIpc({ contents, windowId }: IpcContext): void {
  implement(Documents, contents, {
    GetFiles: () => getFiddleFiles(windowId),
    EditFile: (name, text, fiddleRev) => editFile(windowId, name, text, fiddleRev),
    AddFile: (name) => updateDoc(windowId, (doc) => docAddFile(doc, name)),
    RenameFile: (oldName, newName) => updateDoc(windowId, (doc) => docRenameFile(doc, oldName, newName)),
    RemoveFile: (name) => updateDoc(windowId, (doc) => docRemoveFile(doc, name)),
    SetFileVisible: (name, visible) => updateDoc(windowId, (doc) => docSetFileVisible(doc, name, visible)),
    SetActiveFile: (name) => updateDoc(windowId, (doc) => docSetActiveFile(doc, name)),
    SetLayout: (layout) => setLayout(windowId, layout),
    SetView: (view) => setView(windowId, view),
    LoadGist: (idOrUrl, revision) => loadGistIn(windowId, idOrUrl, revision ?? undefined),
    LoadExample: (name) => showMeIn(windowId, name),
    LoadDocsExample: (tag, examplePath) => loadDocsExampleIn(windowId, tag, examplePath),
    OpenDropped: (text) => openDropped(windowId, text),
  });
}
