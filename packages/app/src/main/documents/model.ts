/** Every function here returns a new `Doc`; none mutates its argument. */
import {
  addFile,
  fileNames,
  hideFile,
  moveFile,
  removeFile,
  renameFile,
  sameFiles,
  setFileContent,
  showFile,
  visibleFileNames,
  type Fiddle,
} from '../../fiddle/fiddle';
import { reasonError } from '../../fiddle/error-reasons';
import type { FileMap } from '../../fiddle/files';
import { formatOrigin, needsApproval } from '../../fiddle/trust';
import { ErrorCode } from '../../shared/errors';
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
  /** Increases whenever a different fiddle replaces the current one; adding, renaming and removing files keep it. */
  loadRev: number;
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
 * Its baseline is its files (a clean load) unless one is given, e.g. a restored draft.
 * Pass the doc it replaces so `fiddleRev` keeps increasing within a window.
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
    loadRev: (options.previous?.loadRev ?? 0) + 1,
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
  return (
    !sameFiles(doc.fiddle.files, doc.baseline) ||
    !sameFiles(doc.fiddle.modules, doc.baselineModules)
  );
}

/** The files whose text differs from the baseline (new files included), in display order. */
export function dirtyFileNames(doc: Doc): string[] {
  return fileNames(doc.fiddle).filter(
    (name) => doc.fiddle.files[name] !== doc.baseline[name],
  );
}

/** A `normalized` change (a loaded `*` resolved to a version) moves the baseline along for unchanged modules, so it isn't dirty. */
export function docSetModules(
  doc: Doc,
  modules: Readonly<Record<string, string>>,
  normalized = false,
): Doc {
  let baselineModules = doc.baselineModules;
  if (normalized) {
    const next = { ...baselineModules };
    for (const [name, spec] of Object.entries(modules)) {
      if (Object.hasOwn(next, name) && next[name] === doc.fiddle.modules[name])
        next[name] = spec;
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
export function applyEdit(
  doc: Doc,
  name: string,
  text: string,
  fiddleRev: number,
): Doc | undefined {
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
  return withNames(
    doc,
    fiddle,
    doc.activeFile === name ? firstVisible(fiddle) : doc.activeFile,
  );
}

export function docSetFileVisible(doc: Doc, name: string, visible: boolean): Doc {
  const fiddle = visible ? showFile(doc.fiddle, name) : hideFile(doc.fiddle, name);
  let activeFile = doc.activeFile;
  if (visible && activeFile === null) activeFile = name;
  if (!visible && activeFile === name) activeFile = visibleFileNames(fiddle)[0] ?? null;
  return { ...doc, fiddle, activeFile };
}

/** Moves a file's tab and sidebar row. The set of names is unchanged, so `fiddleRev` stays. */
export function docMoveFile(doc: Doc, name: string, before: string | null): Doc {
  const fiddle = moveFile(doc.fiddle, name, before);
  return fiddle === doc.fiddle ? doc : { ...doc, fiddle };
}

/** Moves the selected tab (the active file, or the first tab when that is hidden) one place along the row. */
export function docMoveActiveTab(doc: Doc, direction: -1 | 1): Doc {
  const visible = visibleFileNames(doc.fiddle);
  const name = visible.find((n) => n === doc.activeFile) ?? visible[0];
  if (name === undefined) return doc;
  const index = visible.indexOf(name);
  if (direction < 0 ? index === 0 : index === visible.length - 1) return doc;
  const before = direction < 0 ? visible[index - 1] : visible[index + 2];
  return docMoveFile(doc, name, before ?? null);
}

/** Focusing a hidden file shows it. */
export function docSetActiveFile(doc: Doc, name: string): Doc {
  if (!Object.hasOwn(doc.fiddle.files, name)) {
    throw reasonError(ErrorCode.notFound, 'file-not-found', `No file named "${name}"`, {
      name,
    });
  }
  return { ...doc, fiddle: showFile(doc.fiddle, name), activeFile: name };
}

/** The files that were saved, loaded or published before and that the fiddle has since lost (removed or renamed). */
export function removedFileNames(doc: Doc): string[] {
  return Object.keys(doc.baseline).filter(
    (name) => !Object.hasOwn(doc.fiddle.files, name),
  );
}

export function toFiddleState(doc: Doc): FiddleState {
  const { fiddle } = doc;
  const source: FiddleState['source'] = {
    origin: formatOrigin(fiddle.origin),
    trusted: isTrusted(doc),
  };
  if (fiddle.source.localPath !== undefined) source.localPath = fiddle.source.localPath;
  if (fiddle.source.gistId !== undefined) source.gistId = fiddle.source.gistId;
  if (fiddle.source.gistRevision !== undefined)
    source.gistRevision = fiddle.source.gistRevision;
  if (doc.gistOwner !== undefined) source.gistOwner = doc.gistOwner;
  if (fiddle.templateName !== undefined) source.templateName = fiddle.templateName;
  return {
    source,
    name: doc.name,
    versionRef: fiddle.version,
    modules: { ...fiddle.modules },
    files: fileNames(fiddle).map((name) => ({
      name,
      visible: !fiddle.hidden.includes(name),
    })),
    activeFile: doc.activeFile,
    fiddleRev: doc.fiddleRev,
    dirty: isDirty(doc),
    dirtyFiles: dirtyFileNames(doc),
  };
}
