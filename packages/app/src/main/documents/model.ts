/**
 * The editor mirror for one window: the fiddle main holds, its last-saved
 * baseline, and the pieces of the `Window` store derived from them. Pure and
 * immutable: every function returns a new `Doc`. No Electron imports.
 */
import {
  addFile,
  fileNames,
  hideFile,
  removeFile,
  renameFile,
  sameFiles,
  setFileContent,
  showFile,
  visibleFileNames,
  type Fiddle,
} from '../../fiddle/fiddle';
import type { FileMap } from '../../fiddle/files';
import { formatOrigin, needsApproval } from '../../fiddle/trust';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { FiddleState } from '../../shared/stores';

/** `templateName` of the default template, the only one that follows version changes. */
export const DEFAULT_TEMPLATE = 'template';
export const TEST_TEMPLATE = 'test';

export interface Doc {
  fiddle: Fiddle;
  /** The files as last loaded, saved or published. `dirty` compares against it. */
  baseline: FileMap;
  /** The modules as last loaded, saved or published: they're the saved `package.json`. */
  baselineModules: Readonly<Record<string, string>>;
  /** Increases whenever a new fiddle, or a new set of names, replaces the mirror. */
  fiddleRev: number;
  activeFile: string | null;
  /** The project name: the folder name, the example name, or a random name. */
  name: string;
  gistOwner?: string;
  /** The formatted origin the user approved for code-executing operations. */
  approvedOrigin?: string;
  /** The user let untrusted packages run install scripts in that approval. */
  approvedScripts?: boolean;
}

/** The fiddle part of a window's store before Documents fills it in. */
export function emptyFiddleState(): FiddleState {
  return {
    source: { origin: 'local', trusted: true },
    name: '',
    versionRef: { kind: 'release', version: '' },
    modules: {},
    files: [],
    activeFile: null,
    fiddleRev: 0,
    dirty: false,
    dirtyFiles: [],
  };
}

function firstVisible(fiddle: Fiddle): string | null {
  return visibleFileNames(fiddle)[0] ?? fileNames(fiddle)[0] ?? null;
}

/**
 * A doc for a freshly loaded fiddle. Its baseline is its files (a clean load)
 * unless one is given, e.g. when a draft is restored. Pass the doc it replaces
 * so `fiddleRev` keeps increasing within a window.
 */
export function createDoc(
  fiddle: Fiddle,
  name: string,
  options: {
    previous?: Doc;
    baseline?: FileMap;
    baselineModules?: Readonly<Record<string, string>>;
    activeFile?: string | null;
    gistOwner?: string;
  } = {},
): Doc {
  const doc: Doc = {
    fiddle,
    baseline: options.baseline ?? fiddle.files,
    baselineModules: options.baselineModules ?? fiddle.modules,
    fiddleRev: (options.previous?.fiddleRev ?? 0) + 1,
    activeFile:
      options.activeFile && Object.hasOwn(fiddle.files, options.activeFile)
        ? options.activeFile
        : firstVisible(fiddle),
    name,
  };
  if (options.gistOwner !== undefined) doc.gistOwner = options.gistOwner;
  return doc;
}

export function isDirty(doc: Doc): boolean {
  return !sameFiles(doc.fiddle.files, doc.baseline) || !sameFiles(doc.fiddle.modules, doc.baselineModules);
}

/** The files whose text differs from the baseline (new files included), in display order. */
export function dirtyFileNames(doc: Doc): string[] {
  return fileNames(doc.fiddle).filter((name) => doc.fiddle.files[name] !== doc.baseline[name]);
}

/**
 * Replaces the modules. A `normalized` change (a loaded `*` resolved to the
 * latest version) moves the baseline along for modules the user hadn't
 * changed, so it doesn't mark the fiddle dirty.
 */
export function docSetModules(doc: Doc, modules: Readonly<Record<string, string>>, normalized = false): Doc {
  let baselineModules = doc.baselineModules;
  if (normalized) {
    const next = { ...baselineModules };
    for (const [name, spec] of Object.entries(modules)) {
      if (Object.hasOwn(next, name) && next[name] === doc.fiddle.modules[name]) next[name] = spec;
    }
    baselineModules = next;
  }
  return { ...doc, baselineModules, fiddle: { ...doc.fiddle, modules: { ...modules } } };
}

/** True for an unedited default template, which a version change replaces. */
export function isUneditedTemplate(doc: Doc): boolean {
  return doc.fiddle.templateName === DEFAULT_TEMPLATE && !isDirty(doc);
}

export function isTrusted(doc: Doc): boolean {
  return !needsApproval(doc.fiddle.origin, doc.approvedOrigin);
}

/** Applies the renderer's text for one file, or returns undefined if `fiddleRev` is stale. */
export function applyEdit(doc: Doc, name: string, text: string, fiddleRev: number): Doc | undefined {
  if (fiddleRev !== doc.fiddleRev) return undefined;
  if (doc.fiddle.files[name] === text) return doc;
  return { ...doc, fiddle: setFileContent(doc.fiddle, name, text) };
}

/** Adding, renaming and removing change the set of names, so they bump `fiddleRev`. */
function withNames(doc: Doc, fiddle: Fiddle, activeFile: string | null): Doc {
  return { ...doc, fiddle, activeFile, fiddleRev: doc.fiddleRev + 1 };
}

export function docAddFile(doc: Doc, name: string): Doc {
  return withNames(doc, addFile(doc.fiddle, name), name);
}

export function docRenameFile(doc: Doc, from: string, to: string): Doc {
  const fiddle = renameFile(doc.fiddle, from, to);
  return withNames(doc, fiddle, doc.activeFile === from ? to : doc.activeFile);
}

export function docRemoveFile(doc: Doc, name: string): Doc {
  const fiddle = removeFile(doc.fiddle, name);
  return withNames(doc, fiddle, doc.activeFile === name ? firstVisible(fiddle) : doc.activeFile);
}

export function docSetFileVisible(doc: Doc, name: string, visible: boolean): Doc {
  const fiddle = visible ? showFile(doc.fiddle, name) : hideFile(doc.fiddle, name);
  let activeFile = doc.activeFile;
  if (visible && activeFile === null) activeFile = name;
  if (!visible && activeFile === name) activeFile = visibleFileNames(fiddle)[0] ?? null;
  return { ...doc, fiddle, activeFile };
}

/** Focusing a hidden file shows it (§17.3). */
export function docSetActiveFile(doc: Doc, name: string): Doc {
  if (!Object.hasOwn(doc.fiddle.files, name)) {
    throw new FiddleError(ErrorCode.notFound, `No file named "${name}"`, { reason: 'file-not-found', name });
  }
  return { ...doc, fiddle: showFile(doc.fiddle, name), activeFile: name };
}

/** After a save or publish: the mirror becomes the baseline. */
export function markSaved(doc: Doc, source: Fiddle['source']): Doc {
  return { ...doc, fiddle: { ...doc.fiddle, source }, baseline: doc.fiddle.files, baselineModules: doc.fiddle.modules };
}

/** The fiddle part of the `Window` store. */
export function toFiddleState(doc: Doc): FiddleState {
  const { fiddle } = doc;
  const source: FiddleState['source'] = {
    origin: formatOrigin(fiddle.origin),
    trusted: isTrusted(doc),
  };
  if (fiddle.source.localPath !== undefined) source.localPath = fiddle.source.localPath;
  if (fiddle.source.gistId !== undefined) source.gistId = fiddle.source.gistId;
  if (fiddle.source.gistRevision !== undefined) source.gistRevision = fiddle.source.gistRevision;
  if (doc.gistOwner !== undefined) source.gistOwner = doc.gistOwner;
  if (fiddle.templateName !== undefined) source.templateName = fiddle.templateName;
  return {
    source,
    name: doc.name,
    versionRef: fiddle.version,
    modules: { ...fiddle.modules },
    files: fileNames(fiddle).map((name) => ({ name, visible: !fiddle.hidden.includes(name) })),
    activeFile: doc.activeFile,
    fiddleRev: doc.fiddleRev,
    dirty: isDirty(doc),
    dirtyFiles: dirtyFileNames(doc),
  };
}
