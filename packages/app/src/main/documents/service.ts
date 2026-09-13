/**
 * The Documents service: every window's fiddle and editor mirror, drafts,
 * session restore, new/open/save, remote loading, deep links, trust approval
 * and unsaved-change prompts.
 *
 * The load and save logic is in ./load.ts and the mirror in ./model.ts, so
 * both work without a window (and in the headless CLI). This file adds the
 * windows, native dialogs and persistence.
 *
 * Other slices call: `getFiddle`, `getFiddleFiles`, `ensureTrusted`,
 * `setFiddleVersion`, `setFiddleModules`, `markPublished`, `markGistDeleted`
 * and `setDocumentHooks`.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  app,
  dialog,
  type MessageBoxOptions,
  type MessageBoxReturnValue,
  type OpenDialogOptions,
  type WebContents,
} from 'electron';
import * as semver from 'semver';
import { z } from 'zod';

import { findDeepLinkInArgv, isDeepLink, parseDeepLink } from '../../fiddle/deep-link';
import { findExample } from '../../fiddle/examples';
import type { Fiddle, VersionRef } from '../../fiddle/fiddle';
import type { FileMap } from '../../fiddle/files';
import { findExistingSupportedFiles } from '../../fiddle/folder';
import type { ForgeTransformOptions } from '../../fiddle/forge';
import { getGistId } from '../../fiddle/gist-id';
import { GitHubClient } from '../../fiddle/github';
import { getProjectName } from '../../fiddle/names';
import { createTemplateLoader, type TemplateLoader } from '../../fiddle/templates';
import { formatOrigin, isUntrustedOrigin, needsApproval } from '../../fiddle/trust';
import type mainDocuments from '../../i18n/generated/en/mainDocuments';
import { ErrorCode, FiddleError } from '../../shared/errors';
import {
  DEFAULT_LAYOUT,
  windowLayoutSchema,
  type Platform,
  type WindowLayout,
  type WindowView,
} from '../../shared/stores';
import { tm } from '../i18n';
import { log } from '../log';
import { createJsonStore, type JsonStore } from '../persistence/json-store';
import type { StateHub, WindowInit } from '../state-hub';
import { getCacheRoot, getEndpoints } from '../test-mode';
import { getWindow } from '../windows';
import { DeepLinkQueue, gistLinkDetail } from './deep-link-queue';
import { DraftScheduler, DraftStore, storedFiddleSchema, type Draft, type StoredFiddle } from './drafts';
import {
  fiddleFromGist,
  gistDependencies,
  loadElectronExample,
  loadFolder,
  loadGist,
  loadShowMe,
  newFiddle,
  newTest,
  saveToFolder,
  type LoadContext,
  type LoadedFiddle,
  type LoadWarning,
} from './load';
import {
  applyEdit,
  createDoc,
  isDirty,
  isUneditedTemplate,
  TEST_TEMPLATE,
  toFiddleState,
  type Doc,
} from './model';

// ---------------------------------------------------------------------------
// Hooks other slices can replace.

/** Forge for exported projects. The app's own Forge is a prerelease, so projects get the stable line. */
const FORGE_VERSION = '^7.8.0';
const RECENT_LIMIT = 10;

export interface DocumentHooks {
  /** The version new windows start with. Versions slice: the last-used or latest stable. */
  defaultVersion(): VersionRef;
  /** Majors with a minimal-repro template branch. */
  isReleasedMajor(major: number): boolean;
  /** False for versions that are unreleased or can't run here (gist `package.json`). */
  isUsableVersion(version: string): boolean;
  /** A GitHub client; the Gists slice can return one with the user's token. */
  github(): GitHubClient;
  /** Options for "Save as Forge project", e.g. a local build's path. */
  forgeOptions(fiddle: Fiddle): ForgeTransformOptions;
}

const appElectron = (): string => process.versions.electron ?? '0.0.0';

const hooks: DocumentHooks = {
  defaultVersion: () => ({ kind: 'release', version: appElectron() }),
  isReleasedMajor: (major) => major <= (semver.parse(appElectron())?.major ?? 0),
  isUsableVersion: (version) => semver.valid(version) !== null,
  github: () => {
    const endpoints = getEndpoints();
    return new GitHubClient({ apiBaseUrl: endpoints.githubApi, rawOrigins: [endpoints.gistRaw] });
  },
  forgeOptions: () => ({ forgeVersion: FORGE_VERSION }),
};

/** Operations that run the fiddle's code (§4 Trust model). */
export type CodeExecutingOperation = 'run' | 'install-modules' | 'auto-bisect' | 'package' | 'make';

export function setDocumentHooks(partial: Partial<DocumentHooks>): void {
  Object.assign(hooks, partial);
}

// ---------------------------------------------------------------------------
// State.

const sessionEntrySchema = z.object({
  windowId: z.string(),
  name: z.string(),
  fiddle: storedFiddleSchema.omit({ files: true }).extend({ fileNames: z.array(z.string()) }),
  activeFile: z.string().nullable(),
  layout: windowLayoutSchema,
  gistOwner: z.string().optional(),
});
type SessionEntry = z.infer<typeof sessionEntrySchema>;

/** `state.json`. Loose: other slices may keep their own keys here through `getStateStore()`. */
const stateSchema = z.looseObject({
  sessions: z.array(sessionEntrySchema),
  recentFolders: z.array(z.string()),
});
export type AppStateFile = z.infer<typeof stateSchema>;

interface Deps {
  hub: StateHub;
  platform: Platform;
  createWindow(windowId: string, init: WindowInit): Promise<unknown>;
}

let deps: Deps | undefined;
let templates: TemplateLoader;
let stateStore: JsonStore<AppStateFile> | undefined;
let draftStore: DraftStore;
const docs = new Map<string, Doc>();
const draftsOnDisk = new Set<string>();
const drafts = new DraftScheduler((windowId) => writeDraft(windowId));
const deepLinks = new DeepLinkQueue(handleDeepLink, () => getWindow(lastFocused)?.focus());
const pendingOpenFiles: string[] = [];
let started = false;
let quitting = false;
let sessionFrozen = false;
let sessionTimer: NodeJS.Timeout | undefined;
let lastFocused: string | undefined;

type DocKey = keyof typeof mainDocuments;
function td(key: DocKey, options?: Record<string, string>): string {
  return (tm('mainDocuments') as unknown as (k: string, o?: object) => string)(key, options);
}

function hub(): StateHub {
  if (!deps) throw new FiddleError(ErrorCode.unavailable, 'Documents are not initialized');
  return deps.hub;
}

/** The app's bundled `static/` folder (quick-start template, Show Me examples). */
export function staticDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'static')
    : path.join(app.getAppPath(), 'static');
}

/** `<userData>/state.json`, shared with other slices. Available after `initDocuments`. */
export function getStateStore(): JsonStore<AppStateFile> {
  if (!stateStore) throw new FiddleError(ErrorCode.unavailable, 'Documents are not initialized');
  return stateStore;
}

// ---------------------------------------------------------------------------
// Startup.

/**
 * Before `ready`: takes the single-instance lock and starts listening for
 * deep links (`argv`, `second-instance`, `open-url`) and `open-file`.
 * Returns false when another instance owns the lock; the caller quits.
 */
export function installEarlyDocumentHandlers(): boolean {
  if (!app.requestSingleInstanceLock()) return false;
  const coldLink = findDeepLinkInArgv(process.argv);
  if (coldLink) deepLinks.push(coldLink);
  app.on('second-instance', (_event, argv) => {
    const link = findDeepLinkInArgv(argv);
    if (link) deepLinks.push(link);
    else focusWindow(lastFocused);
  });
  app.on('open-url', (event, url) => {
    event.preventDefault();
    deepLinks.push(url);
  });
  app.on('open-file', (event, file) => {
    event.preventDefault();
    if (started) void withErrorDialog(lastFocused, () => openFolderIn(lastFocused, file));
    else pendingOpenFiles.push(file);
  });
  app.on('before-quit', onBeforeQuit);
  return true;
}

/** After `ready` and i18n, before menus and windows. */
export function initDocuments(options: Deps): void {
  deps = options;
  const userData = app.getPath('userData');
  templates = createTemplateLoader({
    staticDir: staticDir(),
    cacheDir: path.join(getCacheRoot(), 'templates'),
    isReleasedMajor: (major) => hooks.isReleasedMajor(major),
    archiveBaseUrl: `${getEndpoints().minimalRepro}/archive`,
    onFallback: (branch, error) => log.warn('template download failed, using the quick-start', branch, error),
  });
  stateStore = createJsonStore<AppStateFile>({
    file: path.join(userData, 'state.json'),
    schema: stateSchema,
    defaults: { sessions: [], recentFolders: [] },
    version: 1,
  });
  draftStore = new DraftStore(path.join(userData, 'drafts'));
}

/** Reopens the last session (or a new window), offers orphaned drafts, then handles queued links and files. */
export async function startDocuments(): Promise<void> {
  const onDisk = await draftStore.list();
  for (const id of onDisk) draftsOnDisk.add(id);
  const unclaimed = new Set(onDisk);

  if (hub().app.settings.sessionRestore) {
    for (const entry of getStateStore().get().sessions) {
      unclaimed.delete(entry.windowId);
      try {
        await restoreWindow(entry);
      } catch (error) {
        log.error('could not restore a window', entry.windowId, error);
      }
    }
  }
  if (docs.size === 0) await openFiddleWindow();

  const orphans = [...unclaimed].flatMap((id) => {
    const draft = draftStore.read(id);
    return draft ? [draft] : [];
  });
  if (orphans.length > 0) {
    const { response } = await messageBox(lastFocused, {
      type: 'question',
      message: td('restoreMessage'),
      detail: td('restoreDetail', { names: orphans.map((draft) => draft.name).join(', ') }),
      buttons: [td('restore'), td('discardDrafts')],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    for (const draft of orphans) {
      if (response === 0) await openFiddleWindow({ windowId: draft.windowId, doc: docFromDraft(draft) });
      else await removeDraft(draft.windowId);
    }
  }

  started = true;
  await deepLinks.start();
  for (const file of pendingOpenFiles.splice(0)) {
    await withErrorDialog(lastFocused, () => openFolderIn(lastFocused, file));
  }
}

async function restoreWindow(entry: SessionEntry): Promise<void> {
  const draft = draftsOnDisk.has(entry.windowId) ? draftStore.read(entry.windowId) : undefined;
  const doc = draft ? docFromDraft(draft) : await docFromSession(entry);
  await openFiddleWindow({ windowId: entry.windowId, doc, layout: entry.layout });
}

function docFromDraft(draft: Draft): Doc {
  const fiddle = restoreFiddle(draft.fiddle!);
  return createDoc(fiddle, draft.name, {
    baseline: draft.baseline,
    activeFile: draft.activeFile,
    ...(draft.gistOwner ? { gistOwner: draft.gistOwner } : {}),
  });
}

/** A clean window is reloaded from its source; on failure it falls back to the template. */
async function docFromSession(entry: SessionEntry): Promise<Doc> {
  const stored = entry.fiddle;
  const context: LoadContext = { version: stored.version, modules: stored.modules };
  const origin = stored.origin;
  let loaded: LoadedFiddle;
  try {
    if (stored.source.localPath) {
      loaded = await loadFolder(stored.source.localPath, context);
    } else if (stored.source.gistId) {
      loaded = await loadGist(hooks.github(), stored.source.gistId, stored.source.gistRevision, {
        context,
        confirmAddFile: (name) => Promise.resolve(stored.fileNames.includes(name)),
      });
    } else if (origin.kind === 'electron') {
      loaded = await loadElectronExample(hooks.github(), templates, origin.tag, origin.path);
    } else if (stored.templateName === TEST_TEMPLATE) {
      loaded = await newTest(templates, stored.version);
    } else if (stored.templateName && findExample(stored.templateName)) {
      loaded = await loadShowMe(staticDir(), stored.templateName, context);
    } else {
      loaded = await newFiddle(templates, stored.version);
    }
  } catch (error) {
    log.warn('restoring from the source failed, using the template', error);
    loaded = await newFiddle(templates, stored.version);
  }
  const files = loaded.fiddle.files;
  const fiddle: Fiddle = {
    ...loaded.fiddle,
    version: stored.version,
    modules: stored.modules,
    hidden: stored.hidden.filter((name) => Object.hasOwn(files, name)),
  };
  return createDoc(fiddle, entry.name, {
    activeFile: entry.activeFile,
    ...(entry.gistOwner ? { gistOwner: entry.gistOwner } : {}),
  });
}

// ---------------------------------------------------------------------------
// Windows.

export interface OpenWindowOptions {
  windowId?: string;
  doc?: Doc;
  layout?: WindowLayout;
}

/** Opens a window for `doc`, or for a new fiddle from the default template. Returns its ID. */
export async function openFiddleWindow(options: OpenWindowOptions = {}): Promise<string> {
  if (!deps) throw new FiddleError(ErrorCode.unavailable, 'Documents are not initialized');
  const windowId = options.windowId ?? randomUUID();
  let doc = options.doc;
  if (!doc) {
    const loaded = await newFiddle(templates, hooks.defaultVersion());
    doc = createDoc(loaded.fiddle, loaded.name);
  }
  docs.set(windowId, doc);
  lastFocused = windowId;
  await deps.createWindow(windowId, {
    title: titleOf(doc),
    view: 'editor',
    fiddle: toFiddleState(doc),
    layout: options.layout ?? DEFAULT_LAYOUT,
  });
  if (docs.has(windowId)) commit(windowId, doc);
  return windowId;
}

/** Called from the window's IPC binding: close prompts, focus tracking, file drops. */
export function attachWindow(windowId: string, contents: WebContents): void {
  const win = getWindow(windowId);
  let closeApproved = false;
  win?.on('focus', () => {
    lastFocused = windowId;
  });
  win?.on('close', (event) => {
    const doc = docs.get(windowId);
    if (quitting || closeApproved || !doc || !isDirty(doc)) return;
    event.preventDefault();
    void (async () => {
      const { response } = await messageBox(windowId, {
        type: 'warning',
        message: td('closeMessage', { name: doc.name }),
        buttons: [td('save'), td('dontSave'), td('cancel')],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      });
      if (response === 2) return;
      if (response === 0 && !(await saveIn(windowId, 'save'))) return;
      closeApproved = true;
      getWindow(windowId)?.close();
    })();
  });
  // A folder dropped on the page navigates to its file:// URL; open it instead.
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) return;
    event.preventDefault();
    void withErrorDialog(windowId, async () => {
      const target = fileURLToPath(url);
      const stat = await fs.stat(target);
      await openFolderIn(windowId, stat.isDirectory() ? target : path.dirname(target));
    });
  });
  contents.once('destroyed', () => onDestroyed(windowId));
}

function onDestroyed(windowId: string): void {
  // Closing the last window quits the app (except on macOS): keep it in the session.
  if (!quitting && docs.size === 1 && deps?.platform !== 'darwin') {
    saveSessionNow();
    sessionFrozen = true;
  }
  if (!quitting) {
    drafts.cancel(windowId);
    void removeDraft(windowId);
  }
  docs.delete(windowId);
  if (lastFocused === windowId) lastFocused = docs.keys().next().value;
  scheduleSessionSave();
}

function onBeforeQuit(event: Electron.Event): void {
  if (quitting) return;
  const dirty = [...docs].filter(([, doc]) => isDirty(doc));
  const finish = () => {
    quitting = true;
    drafts.flushAll();
    saveSessionNow();
    sessionFrozen = true;
  };
  if (dirty.length === 0) {
    finish();
    return;
  }
  event.preventDefault();
  void (async () => {
    const { response } = await messageBox(lastFocused, {
      type: 'warning',
      message: td('quitMessage'),
      detail: td('quitDetail'),
      buttons: [td('quit'), td('cancel')],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (response !== 0) return;
    finish();
    app.quit();
  })();
}

export function closeWindow(windowId: string | undefined): void {
  getWindow(windowId)?.close();
}

function focusWindow(windowId: string | undefined): void {
  const win = getWindow(windowId);
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

// ---------------------------------------------------------------------------
// Committing changes.

function titleOf(doc: Doc): string {
  return isDirty(doc) ? td('titleEdited', { name: doc.name }) : doc.name;
}

function revOf(windowId: string): number {
  return deps?.hub.getWindow(windowId)?.rev ?? 0;
}

function requireDoc(windowId: string | undefined): Doc {
  const doc = windowId === undefined ? undefined : docs.get(windowId);
  if (!doc) throw new FiddleError(ErrorCode.notFound, `Window ${windowId} has no fiddle`);
  return doc;
}

/** Stores `doc` as the window's fiddle, pushes the store, and keeps title, draft and session in step. */
function commit(windowId: string, doc: Doc): number {
  docs.set(windowId, doc);
  const title = titleOf(doc);
  const rev = hub().updateWindow(windowId, { fiddle: toFiddleState(doc), title });
  const win = getWindow(windowId);
  if (win) {
    win.setTitle(title);
    if (deps?.platform === 'darwin') win.setDocumentEdited(isDirty(doc));
  }
  syncDraft(windowId, doc);
  scheduleSessionSave();
  return rev;
}

function syncDraft(windowId: string, doc: Doc): void {
  if (isDirty(doc)) {
    drafts.touch(windowId);
  } else if (drafts.isPending(windowId) || draftsOnDisk.has(windowId)) {
    drafts.cancel(windowId);
    void removeDraft(windowId);
  }
}

export function updateDoc(windowId: string, change: (doc: Doc) => Doc): number {
  return commit(windowId, change(requireDoc(windowId)));
}

/** `EditFile`: most edits change only the mirror, so the store is pushed only when `dirty` flips. */
export function editFile(windowId: string, name: string, text: string, fiddleRev: number): number {
  const doc = requireDoc(windowId);
  const next = applyEdit(doc, name, text, fiddleRev);
  if (!next || next === doc) return revOf(windowId);
  if (isDirty(next) !== isDirty(doc)) return commit(windowId, next);
  docs.set(windowId, next);
  syncDraft(windowId, next);
  return revOf(windowId);
}

export function setLayout(windowId: string, layout: WindowLayout): number {
  const rev = hub().updateWindow(windowId, { layout });
  scheduleSessionSave();
  return rev;
}

export function setView(windowId: string, view: WindowView): number {
  return hub().updateWindow(windowId, { view });
}

// ---------------------------------------------------------------------------
// Public API for other slices.

export function getFiddle(windowId: string): Fiddle {
  return requireDoc(windowId).fiddle;
}

export function getFiddleFiles(windowId: string): FileMap {
  return { ...requireDoc(windowId).fiddle.files };
}

export function currentTemplateName(windowId: string): string | undefined {
  return docs.get(windowId)?.fiddle.templateName;
}

/**
 * Sets the window's Electron version. An unedited default template is
 * replaced with the new version's template (§17.4).
 */
export async function setFiddleVersion(windowId: string, versionRef: VersionRef): Promise<number> {
  const doc = requireDoc(windowId);
  if (isUneditedTemplate(doc)) {
    try {
      const loaded = await newFiddle(templates, versionRef);
      if (docs.get(windowId) === doc) return commit(windowId, createDoc(loaded.fiddle, doc.name, { previous: doc }));
    } catch (error) {
      log.warn('could not load the template for the new version', error);
    }
  }
  const current = requireDoc(windowId);
  return commit(windowId, { ...current, fiddle: { ...current.fiddle, version: versionRef } });
}

export function setFiddleModules(windowId: string, modules: Record<string, string>): number {
  return updateDoc(windowId, (doc) => ({ ...doc, fiddle: { ...doc.fiddle, modules: { ...modules } } }));
}

/** After publishing: the gist is linked, the folder unlinked (§17.5), and the draft deleted. */
export function markPublished(
  windowId: string,
  gist: { id: string; revision?: string; owner?: string | null },
  files: FileMap = getFiddleFiles(windowId),
): number {
  return updateDoc(windowId, (doc) => ({
    ...doc,
    baseline: files,
    ...(gist.owner ? { gistOwner: gist.owner } : {}),
    fiddle: {
      ...doc.fiddle,
      source: { gistId: gist.id, ...(gist.revision ? { gistRevision: gist.revision } : {}) },
    },
  }));
}

/** Deleting the gist unlinks it and marks the fiddle unsaved (§17.5). */
export function markGistDeleted(windowId: string): number {
  return updateDoc(windowId, (doc) => {
    const { localPath } = doc.fiddle.source;
    return {
      ...doc,
      baseline: {},
      fiddle: { ...doc.fiddle, source: localPath === undefined ? {} : { localPath } },
    };
  });
}

/**
 * Before a code-executing operation: approves the fiddle's origin, showing
 * the native trust dialog (origin, files, dependencies) if it is untrusted.
 * `allowScripts` says whether module install scripts may run.
 */
export async function ensureTrusted(
  windowId: string,
  operation: CodeExecutingOperation,
  options: { packagesWithInstallScripts?: readonly string[] } = {},
): Promise<{ approved: boolean; allowScripts: boolean }> {
  const doc = requireDoc(windowId);
  const origin = doc.fiddle.origin;
  if (!isUntrustedOrigin(origin)) return { approved: true, allowScripts: true };
  log.info('trust check', operation, formatOrigin(origin));
  if (!needsApproval(origin, doc.approvedOrigin)) {
    return { approved: true, allowScripts: doc.approvedScripts ?? false };
  }
  const packages = options.packagesWithInstallScripts ?? [];
  const dependencies = Object.entries(doc.fiddle.modules).map(([name, spec]) => `${name}@${spec}`);
  const result = await messageBox(windowId, {
    type: 'warning',
    message: td('trustMessage'),
    detail: [
      td('trustDetail'),
      '',
      td('detailOrigin', { origin: formatOrigin(origin) }),
      td('detailFiles', { files: listOrNone(Object.keys(doc.fiddle.files)) }),
      td('detailDependencies', { dependencies: listOrNone(dependencies) }),
    ].join('\n'),
    buttons: [td('trustContinue'), td('cancel')],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    ...(packages.length > 0
      ? { checkboxLabel: td('trustAllowScripts', { packages: packages.join(', ') }), checkboxChecked: false }
      : {}),
  });
  const latest = docs.get(windowId);
  if (result.response !== 0 || !latest || latest.fiddle.origin !== origin) return { approved: false, allowScripts: false };
  commit(windowId, { ...latest, approvedOrigin: formatOrigin(origin), approvedScripts: result.checkboxChecked });
  return { approved: true, allowScripts: result.checkboxChecked };
}

// ---------------------------------------------------------------------------
// New, open, load, save.

function contextOf(doc: Doc | undefined): LoadContext {
  return doc
    ? { version: doc.fiddle.version, modules: doc.fiddle.modules }
    : { version: hooks.defaultVersion(), modules: {} };
}

async function confirmReplace(windowId: string): Promise<boolean> {
  const doc = docs.get(windowId);
  if (!doc || !isDirty(doc)) return true;
  return confirm(windowId, td('replaceMessage'), td('replaceDetail', { name: doc.name }), td('discard'), 'warning');
}

/**
 * Replaces the window's fiddle with what `load` returns, after the
 * unsaved-change prompt. Without a window, opens a new one.
 */
async function replaceIn(
  windowId: string | undefined,
  load: (context: LoadContext) => Promise<LoadedFiddle>,
): Promise<number> {
  if (windowId === undefined || !docs.has(windowId)) {
    const loaded = await load(contextOf(undefined));
    const id = await openFiddleWindow({ doc: docFromLoaded(loaded) });
    showWarnings(id, loaded.warnings);
    return revOf(id);
  }
  if (!(await confirmReplace(windowId))) return revOf(windowId);
  const loaded = await load(contextOf(docs.get(windowId)));
  const current = docs.get(windowId);
  if (!current) return 0;
  const rev = commit(windowId, docFromLoaded(loaded, current));
  showWarnings(windowId, loaded.warnings);
  return rev;
}

function docFromLoaded(loaded: LoadedFiddle, previous?: Doc): Doc {
  return createDoc(loaded.fiddle, loaded.name, {
    ...(previous ? { previous } : {}),
    ...(loaded.gistOwner ? { gistOwner: loaded.gistOwner } : {}),
  });
}

export async function newFiddleIn(windowId: string | undefined, kind: 'template' | 'test'): Promise<number> {
  return replaceIn(windowId, (context) =>
    kind === 'test' ? newTest(templates, context.version) : newFiddle(templates, context.version),
  );
}

export async function showMeIn(windowId: string | undefined, name: string): Promise<number> {
  return replaceIn(windowId, (context) => loadShowMe(staticDir(), name, context));
}

function askAddFile(windowId: string | undefined): (name: string) => Promise<boolean> {
  return async (name) => {
    const { response } = await messageBox(windowId, {
      type: 'question',
      message: td('addFileMessage', { name }),
      detail: td('addFileDetail'),
      buttons: [td('add'), td('skip')],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    return response === 0;
  };
}

/** `LoadGist`: a gist URL or ID, optionally at a revision. */
export async function loadGistIn(windowId: string, idOrUrl: string, revision?: string): Promise<number> {
  const id = getGistId(idOrUrl);
  if (!id) throw new FiddleError(ErrorCode.invalidArgument, `Not a gist URL or ID: ${idOrUrl}`, { reason: 'invalid-gist-id' });
  return replaceIn(windowId, (context) =>
    loadGist(hooks.github(), id, revision, {
      context,
      confirmAddFile: askAddFile(windowId),
      isUsableVersion: (version) => hooks.isUsableVersion(version),
    }),
  );
}

/** `LoadDocsExample`: asks first, because the code is untrusted (§17.4). */
export async function loadDocsExampleIn(windowId: string, tag: string, examplePath: string): Promise<number> {
  const detail = [td('detailVersion', { version: tag }), td('detailPath', { path: examplePath }), '', td('linkUntrusted')];
  if (!(await confirm(windowId, td('linkDocsMessage'), detail.join('\n'), td('load')))) return revOf(windowId);
  return replaceIn(windowId, () => loadElectronExample(hooks.github(), templates, tag, examplePath));
}

/** `OpenDropped`: a gist URL or an `electron-fiddle://` link dropped on the window. */
export async function openDropped(windowId: string, text: string): Promise<void> {
  const trimmed = text.trim().split(/\s+/)[0] ?? '';
  if (isDeepLink(trimmed)) {
    deepLinks.push(trimmed);
    return;
  }
  if (getGistId(trimmed) && /^(https:\/\/gist\.github\.com\/|[0-9a-f]{32}$)/i.test(trimmed)) {
    await withErrorDialog(windowId, () => loadGistIn(windowId, trimmed));
  }
}

function samePath(a: string | undefined, b: string): boolean {
  if (a === undefined) return false;
  const x = path.resolve(a);
  const y = path.resolve(b);
  return deps?.platform === 'linux' ? x === y : x.toLowerCase() === y.toLowerCase();
}

/** Opens a folder, from the Open dialog when `dir` is undefined. A folder that's already open focuses its window. */
export async function openFolderIn(windowId: string | undefined, dir?: string): Promise<void> {
  if (dir === undefined) {
    const picked = await openDialog(windowId, {
      title: td('openFolderTitle'),
      buttonLabel: td('open'),
      properties: ['openDirectory'],
    });
    if (!picked) return;
    dir = picked;
  }
  const folder = path.resolve(dir);
  const open = [...docs].find(([, doc]) => samePath(doc.fiddle.source.localPath, folder));
  if (open) {
    focusWindow(open[0]);
    return;
  }
  await replaceIn(windowId, (context) => loadFolder(folder, context));
  addRecentFolder(folder);
}

/** Save, Save as, or Save as Forge project. Resolves false if cancelled or failed. */
export async function saveIn(windowId: string, mode: 'save' | 'saveAs' | 'forge'): Promise<boolean> {
  const doc = requireDoc(windowId);
  let dir = doc.fiddle.source.localPath;
  if (mode !== 'save' || dir === undefined) {
    const picked = await openDialog(windowId, {
      title: td('saveFolderTitle'),
      buttonLabel: td('save'),
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
    if (!picked) return false;
    dir = path.resolve(picked);
    const existing = await findExistingSupportedFiles(dir);
    if (
      existing.length > 0 &&
      !(await confirm(
        windowId,
        td('overwriteMessage', { folder: path.basename(dir) }),
        td('overwriteDetail', { files: existing.join(', ') }),
        td('replace'),
        'warning',
      ))
    ) {
      return false;
    }
  }

  const snapshot = requireDoc(windowId);
  const name = getProjectName(dir);
  try {
    await saveToFolder(dir, snapshot.fiddle, {
      name,
      author: packageAuthor(),
      ...(mode === 'forge' ? { forge: hooks.forgeOptions(snapshot.fiddle) } : {}),
    });
  } catch (error) {
    await showError(windowId, td('saveFailed'), error);
    return false;
  }

  const latest = docs.get(windowId);
  if (latest) {
    // Saving to a new folder unlinks the gist (§17.5).
    const linked = samePath(snapshot.fiddle.source.localPath, dir);
    const source = linked ? { ...latest.fiddle.source, localPath: dir } : { localPath: dir };
    const { templateName: _saved, ...fiddle } = latest.fiddle;
    commit(windowId, { ...latest, name, baseline: snapshot.fiddle.files, fiddle: { ...fiddle, source } });
  }
  addRecentFolder(dir);
  return true;
}

function packageAuthor(): string | undefined {
  const author = deps?.hub.app.settings.packageAuthor;
  if (author) return author;
  try {
    return os.userInfo().username;
  } catch {
    return undefined;
  }
}

export function recentFolders(): string[] {
  return stateStore?.get().recentFolders ?? [];
}

function addRecentFolder(dir: string): void {
  app.addRecentDocument(dir);
  getStateStore().set((prev) => ({
    ...prev,
    recentFolders: [dir, ...prev.recentFolders.filter((d) => !samePath(d, dir))].slice(0, RECENT_LIMIT),
  }));
}

export function clearRecentFolders(): void {
  app.clearRecentDocuments();
  getStateStore().set((prev) => ({ ...prev, recentFolders: [] }));
}

// ---------------------------------------------------------------------------
// Deep links.

/** Focused window if it has no unsaved changes; otherwise the link opens in a new window. */
function linkTarget(): string | undefined {
  const doc = lastFocused === undefined ? undefined : docs.get(lastFocused);
  return doc && !isDirty(doc) ? lastFocused : undefined;
}

async function handleDeepLink(url: string): Promise<void> {
  const parsed = parseDeepLink(url);
  if (!parsed.ok) {
    await messageBox(lastFocused, {
      type: 'error',
      message: parsed.error === 'unknown-host' ? td('linkNeedsNewer') : td('linkInvalid'),
      detail: url,
    });
    return;
  }
  const link = parsed.link;
  const target = linkTarget();
  focusWindow(target);
  try {
    let loaded: LoadedFiddle;
    if (link.kind === 'gist') {
      const gist = await hooks.github().loadGist(link.id, link.revision);
      const detail = gistLinkDetail(link, gist, gistDependencies(gist), td);
      if (!(await confirm(target, td('linkGistMessage'), detail, td('load')))) return;
      // Exactly the revision shown in the prompt is loaded.
      loaded = await fiddleFromGist(gist, {
        context: contextOf(target ? docs.get(target) : undefined),
        confirmAddFile: askAddFile(target),
        isUsableVersion: (version) => hooks.isUsableVersion(version),
      });
    } else {
      const detail = [td('detailVersion', { version: link.version }), td('detailPath', { path: link.path }), '', td('linkUntrusted')];
      if (!(await confirm(target, td('linkDocsMessage'), detail.join('\n'), td('load')))) return;
      loaded = await loadElectronExample(hooks.github(), templates, link.tag, link.path);
    }
    const current = target === undefined ? undefined : docs.get(target);
    if (target !== undefined && current && !isDirty(current)) {
      commit(target, docFromLoaded(loaded, current));
      showWarnings(target, loaded.warnings);
    } else {
      const id = await openFiddleWindow({ doc: docFromLoaded(loaded) });
      showWarnings(id, loaded.warnings);
    }
  } catch (error) {
    await showError(target, td('loadFailed'), error);
  }
}

// ---------------------------------------------------------------------------
// Drafts and session.

function storeFiddle(fiddle: Fiddle): StoredFiddle {
  const stored: StoredFiddle = {
    files: fiddle.files,
    hidden: [...fiddle.hidden],
    version: fiddle.version,
    modules: { ...fiddle.modules },
    origin: fiddle.origin,
    source: { ...fiddle.source },
  };
  if (fiddle.templateName !== undefined) stored.templateName = fiddle.templateName;
  return stored;
}

function restoreFiddle(stored: StoredFiddle): Fiddle {
  const fiddle: Fiddle = {
    files: stored.files,
    hidden: stored.hidden.filter((name) => Object.hasOwn(stored.files, name)),
    version: stored.version,
    modules: stored.modules,
    origin: stored.origin,
    source: stored.source,
  };
  if (stored.templateName !== undefined) fiddle.templateName = stored.templateName;
  return fiddle;
}

function writeDraft(windowId: string): void {
  const doc = docs.get(windowId);
  if (!doc || !isDirty(doc)) return;
  draftsOnDisk.add(windowId);
  draftStore.write({
    windowId,
    savedAt: new Date().toISOString(),
    name: doc.name,
    fiddle: storeFiddle(doc.fiddle),
    baseline: doc.baseline,
    activeFile: doc.activeFile,
    ...(doc.gistOwner ? { gistOwner: doc.gistOwner } : {}),
  });
}

async function removeDraft(windowId: string): Promise<void> {
  draftsOnDisk.delete(windowId);
  try {
    await draftStore.remove(windowId);
  } catch (error) {
    log.warn('could not delete a draft', windowId, error);
  }
}

function sessionEntries(): SessionEntry[] {
  return [...docs].map(([windowId, doc]) => {
    const { files, ...fiddle } = storeFiddle(doc.fiddle);
    const entry: SessionEntry = {
      windowId,
      name: doc.name,
      fiddle: { ...fiddle, fileNames: Object.keys(files) },
      activeFile: doc.activeFile,
      layout: deps?.hub.getWindow(windowId)?.layout ?? DEFAULT_LAYOUT,
    };
    if (doc.gistOwner !== undefined) entry.gistOwner = doc.gistOwner;
    return entry;
  });
}

function saveSessionNow(): void {
  if (sessionFrozen || !stateStore) return;
  clearTimeout(sessionTimer);
  sessionTimer = undefined;
  const sessions = sessionEntries();
  stateStore.set((prev) => ({ ...prev, sessions }));
}

function scheduleSessionSave(): void {
  if (sessionFrozen || sessionTimer) return;
  sessionTimer = setTimeout(saveSessionNow, 1000);
}

// ---------------------------------------------------------------------------
// Dialogs.

function listOrNone(items: readonly string[]): string {
  return items.length > 0 ? items.join(', ') : td('none');
}

async function messageBox(windowId: string | undefined, options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
  const win = getWindow(windowId);
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

async function confirm(
  windowId: string | undefined,
  message: string,
  detail: string,
  ok: string,
  type: 'question' | 'warning' = 'question',
): Promise<boolean> {
  const { response } = await messageBox(windowId, {
    type,
    message,
    detail,
    buttons: [ok, td('cancel')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  return response === 0;
}

async function openDialog(windowId: string | undefined, options: OpenDialogOptions): Promise<string | undefined> {
  const win = getWindow(windowId);
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  return result.canceled ? undefined : result.filePaths[0];
}

function errorDetail(error: unknown): string {
  const e = FiddleError.from(error);
  if (e.code === ErrorCode.network) return td('offline');
  if ((e.details as { reason?: unknown } | undefined)?.reason === 'no-supported-files') return td('noSupportedFiles');
  return e.message;
}

async function showError(windowId: string | undefined, title: string, error: unknown): Promise<void> {
  log.warn(title, error);
  await messageBox(windowId, { type: 'error', message: title, detail: errorDetail(error) });
}

/** Runs a menu action and shows a native error if it fails. */
export async function withErrorDialog(windowId: string | undefined, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (FiddleError.from(error).code === ErrorCode.cancelled) return;
    await showError(windowId, td('loadFailed'), error);
  }
}

function showWarnings(windowId: string, warnings: readonly LoadWarning[]): void {
  if (warnings.length === 0) return;
  const lines = warnings.map((warning) => {
    switch (warning.kind) {
      case 'invalid-package-json':
        return td('warnPackageJson');
      case 'unusable-version':
        return td('warnVersion', { version: warning.version });
      case 'rejected-modules':
        return td('warnModules', { modules: warning.modules.map((m) => `${m.name}@${m.spec}`).join(', ') });
    }
  });
  void messageBox(windowId, { type: 'warning', message: td('loadWarnings'), detail: lines.join('\n') });
}
