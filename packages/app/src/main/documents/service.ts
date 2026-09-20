import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app, net, type WebContents } from 'electron';
import { z } from 'zod';

import { findDeepLinkInArgv, isDeepLink, parseDeepLink } from '../../fiddle/deep-link';
import { findExample } from '../../fiddle/examples';
import {
  sameFiles,
  VersionRefSchema,
  visibleFileNames,
  type Fiddle,
  type VersionRef,
} from '../../fiddle/fiddle';
import { orderFiles, type FileMap } from '../../fiddle/files';
import { findFilesToReplace, localPathFromFileUrl } from '../../fiddle/folder';
import { getGistId } from '../../fiddle/gist-id';
import { findInstallScripts } from '../../fiddle/modules';
import { getProjectName } from '../../fiddle/names';
import { osUserName } from '../../fiddle/package-json';
import {
  createTemplateLoader,
  isMissingTemplate,
  type TemplateLoader,
} from '../../fiddle/templates';
import {
  formatOrigin,
  isUntrustedOrigin,
  needsApproval,
  restoredOrigin,
  type FiddleOrigin,
} from '../../fiddle/trust';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { followActiveFile, renamePane } from '../../shared/panes';
import {
  DEFAULT_LAYOUT,
  windowLayoutSchema,
  type Platform,
  type WindowLayout,
  type WindowState,
  type WindowView,
} from '../../shared/stores';
import { confirm, messageBox, pickFolder } from '../dialogs';
import type { GitHubService } from '../github/service';
import { tm } from '../i18n';
import { localizeError } from '../localize-error';
import { log } from '../log';
import type { NpmClient } from '../modules/npm-client';
import { forgeElectronFor, forgeOptionsFor } from '../packaging/service';
import { createJsonStore, type JsonStore } from '../persistence/json-store';
import { cancelRelaunch } from '../platform/locale';
import type { StateHub, WindowInit } from '../state-hub';
import { getCacheRoot, getEndpoints } from '../test-mode';
import { defaultVersionFor } from '../versions/selection';
import type { VersionsService } from '../versions/service';
import { getWindow, sendWindowCommand } from '../windows';
import {
  DeepLinkQueue,
  dialogText,
  gistLinkDetail,
  gistUrlToDeepLink,
  shouldOfferSignIn,
} from './deep-link-queue';
import {
  DraftScheduler,
  DraftStore,
  storedFiddleSchema,
  WINDOW_ID_RE,
  type Draft,
  type StoredFiddle,
} from './drafts';
import {
  fiddleFromGist,
  filesForSave,
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
  dirtyFileNames,
  docRenameFile,
  docSetModules,
  isDirty,
  isTrusted,
  isUneditedTemplate,
  removedFileNames,
  TEST_TEMPLATE,
  toFiddleState,
  type Doc,
} from './model';

const RECENT_LIMIT = 10;

export type CodeExecutingOperation =
  'run' | 'install-modules' | 'auto-bisect' | 'package' | 'make';

/** How many launches keep a window that could not be reopened before it is dropped. */
const RESTORE_ATTEMPTS = 3;
/** How long a new fiddle waits for its template to download before it starts from the bundled one. */
const TEMPLATE_WAIT_MS = 1500;

const sessionEntrySchema = z.object({
  windowId: z.string().regex(WINDOW_ID_RE),
  name: z.string(),
  /** Launches that failed to reopen this window from its folder or gist. */
  failedRestores: z.number().optional(),
  /** `fileNames`: the files the window had, in the order the user gave the tabs. */
  fiddle: storedFiddleSchema
    .omit({ files: true })
    .extend({ fileNames: z.array(z.string()) }),
  activeFile: z.string().nullable(),
  layout: windowLayoutSchema,
  gistOwner: z.string().optional(),
});
type SessionEntry = z.infer<typeof sessionEntrySchema>;

/** `state.json`. Loose: other modules keep their own keys here. */
const stateSchema = z.looseObject({
  sessions: z.array(sessionEntrySchema),
  recentFolders: z.array(z.string()),
  /** Folders with a saved untrusted fiddle, by path: it stays untrusted until approved. */
  untrustedFolders: z.record(z.string(), storedFiddleSchema.shape.origin).optional(),
  tourDone: z.boolean().optional(),
  crashNoticeShown: z.boolean().optional(),
  /** The Electron version the user last picked: new windows start with it. */
  lastVersion: VersionRefSchema.optional(),
});
export type AppStateFile = z.infer<typeof stateSchema>;

interface Deps {
  hub: StateHub;
  platform: Platform;
  versions: Pick<
    VersionsService,
    'releases' | 'release' | 'localBuild' | 'electronVersions'
  >;
  /** Gists load with the signed-in user's client, so private gists work, once the stored token is restored. */
  github: Pick<GitHubService, 'client' | 'whenReady'>;
  npm: Pick<NpmClient, 'packument'>;
  createWindow(windowId: string, init: WindowInit): Promise<unknown>;
  /** A docs example was loaded into the window: select its version like `SetVersion`. */
  onDocsExampleLoaded?(windowId: string): void;
}

let deps: Deps | undefined;
let templates: TemplateLoader;
let stateStore: JsonStore<AppStateFile> | undefined;
let draftStore: DraftStore;
const docs = new Map<string, Doc>();
const draftsOnDisk = new Set<string>();
const drafts = new DraftScheduler((windowId) => writeDraft(windowId));
const deepLinks = new DeepLinkQueue(handleDeepLink, () =>
  getWindow(lastFocused)?.focus(),
);
const pendingOpenFiles: string[] = [];
let started = false;
/** False until the last session is restored: until then the session file still holds the windows being restored. */
let sessionReady = false;
/** Session entries whose window could not be reopened. They stay in the session file for the next launch. */
const unrestored: SessionEntry[] = [];
let quitting = false;
let sessionFrozen = false;
let sessionTimer: NodeJS.Timeout | undefined;
let lastFocused: string | undefined;

const td = tm('mainDocuments');

function requireDeps(): Deps {
  if (!deps)
    throw new FiddleError(ErrorCode.unavailable, 'Documents are not initialized');
  return deps;
}

function hub(): StateHub {
  return requireDeps().hub;
}

const isStable = (version: string): boolean => !version.includes('-');

/** The version new windows start with: the last one the user picked while it's usable, else the latest stable release. */
function defaultVersion(): VersionRef {
  const { versions } = requireDeps();
  return (
    defaultVersionFor(versions.releases(), stateStore?.get().lastVersion, versions) ?? {
      kind: 'release',
      version: process.versions.electron,
    }
  );
}

/** False for versions that are unreleased or can't run here (gist `package.json`). */
function isUsableVersion(version: string): boolean {
  return requireDeps().versions.release(version)?.supported ?? false;
}

function github() {
  return requireDeps().github.client();
}

export function staticDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'static')
    : path.join(app.getAppPath(), 'static');
}

/** `<userData>/state.json`, shared with other modules. Throws before `initDocuments`. */
export function getStateStore(): JsonStore<AppStateFile> {
  if (!stateStore)
    throw new FiddleError(ErrorCode.unavailable, 'Documents are not initialized');
  return stateStore;
}

/** Before `ready`. False when another instance owns the single-instance lock: the caller quits. */
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
    // A gist URL dropped on the dock icon gets the gist link's load and trust prompt.
    deepLinks.push(gistUrlToDeepLink(url) ?? url);
  });
  app.on('open-file', (event, file) => {
    event.preventDefault();
    if (started) void withErrorDialog(lastFocused, () => openFolderIn(lastFocused, file));
    else pendingOpenFiles.push(file);
  });
  app.on('before-quit', onBeforeQuit);
  return true;
}

/** A missing minimal-repro branch is expected; a failed download is worth a warning. */
export function appTemplateLoader(options: {
  isReleasedMajor: (major: number) => boolean;
  fetch: typeof fetch;
  signal?: AbortSignal;
  waitMs?: number;
}): TemplateLoader {
  return createTemplateLoader({
    staticDir: staticDir(),
    cacheDir: path.join(getCacheRoot(), 'templates'),
    archiveBaseUrl: `${getEndpoints().minimalRepro}/archive`,
    onFallback: (branch, error) => {
      if (isMissingTemplate(error))
        log.info(
          `no minimal-repro template for ${branch}, using the bundled quick-start`,
        );
      else
        log.warn(
          `template download failed for ${branch}, using the bundled quick-start: ${FiddleError.from(error).message}`,
        );
    },
    ...options,
  });
}

/** After `ready` and i18n, before menus and windows. */
export function initDocuments(options: Deps): void {
  deps = options;
  const userData = app.getPath('userData');
  templates = appTemplateLoader({
    // Majors with a minimal-repro template branch.
    isReleasedMajor: (major) =>
      options.versions
        .releases()
        .some((r) => isStable(r.version) && Number.parseInt(r.version, 10) === major),
    // Chromium's network stack, so the system proxy applies.
    fetch: (input, init) =>
      net.fetch(
        input instanceof URL ? input.href : (input as string),
        init as RequestInit,
      ),
    waitMs: TEMPLATE_WAIT_MS,
  });
  stateStore = createJsonStore<AppStateFile>({
    file: path.join(userData, 'state.json'),
    schema: stateSchema,
    defaults: { sessions: [], recentFolders: [] },
    version: 1,
  });
  draftStore = new DraftStore(path.join(userData, 'drafts'));
}

export async function startDocuments(): Promise<void> {
  const onDisk = await draftStore.list();
  for (const id of onDisk) draftsOnDisk.add(id);
  const unclaimed = new Set(onDisk);

  if (hub().app.settings.sessionRestore) await restoreSession(unclaimed);
  sessionReady = true;
  if (docs.size === 0) await openFiddleWindow();

  const orphans: Draft[] = [];
  for (const id of unclaimed) {
    const draft = await readDraft(id);
    if (draft) orphans.push(draft);
  }
  if (orphans.length > 0) {
    const { response } = await messageBox(lastFocused, {
      type: 'question',
      message: td('restoreMessage'),
      detail: td('restoreDetail', {
        names: orphans.map((draft) => draft.name).join(', '),
      }),
      buttons: [td('restore'), td('discardDrafts')],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    for (const draft of orphans) {
      if (response === 0)
        await openFiddleWindow({ windowId: draft.windowId, doc: docFromDraft(draft) });
      else await removeDraft(draft.windowId);
    }
  }

  started = true;
  // A private gist in a link loads with the restored token.
  await requireDeps().github.whenReady();
  await deepLinks.start();
  for (const file of pendingOpenFiles.splice(0)) {
    await withErrorDialog(lastFocused, () => openFolderIn(lastFocused, file));
  }
}

/** A window that can't be loaded stays in the session for later launches, and the user is told. */
async function restoreSession(unclaimed: Set<string>): Promise<void> {
  const entries = getStateStore().get().sessions;
  for (const entry of entries) unclaimed.delete(entry.windowId);
  const prepared = await Promise.all(
    entries.map(async (entry) => {
      try {
        const draft = await readDraft(entry.windowId);
        return { entry, doc: draft ? docFromDraft(draft) : await docFromSession(entry) };
      } catch (error) {
        log.warn('could not reopen a window', entry.windowId, error);
        const failedRestores = (entry.failedRestores ?? 0) + 1;
        if (failedRestores < RESTORE_ATTEMPTS)
          unrestored.push({ ...entry, failedRestores });
        return { entry, failed: true as const };
      }
    }),
  );
  await Promise.all(
    prepared.map(async (item) => {
      if ('failed' in item) return;
      try {
        await openFiddleWindow({
          windowId: item.entry.windowId,
          doc: item.doc,
          layout: item.entry.layout,
        });
      } catch (error) {
        log.error('could not restore a window', item.entry.windowId, error);
      }
    }),
  );
  const failed = prepared
    .filter((item) => 'failed' in item)
    .map((item) => item.entry.name);
  if (failed.length > 0) {
    void messageBox(lastFocused, {
      type: 'warning',
      message: td('restoreFailedMessage'),
      detail: td('restoreFailedDetail', { names: failed.join(', ') }),
    });
  }
}

/** A draft that can't be read is set aside for manual recovery, so a clean reload of its window doesn't delete it. */
async function readDraft(windowId: string): Promise<Draft | undefined> {
  if (!draftsOnDisk.has(windowId)) return undefined;
  const draft = draftStore.read(windowId);
  if (!draft) {
    draftsOnDisk.delete(windowId);
    if (await draftStore.setAside(windowId))
      log.warn('set aside an unreadable draft', windowId);
  }
  return draft;
}

function docFromDraft(draft: Draft): Doc {
  const fiddle = restoreFiddle(draft.fiddle!);
  return createDoc(fiddle, draft.name, {
    baseline: draft.baseline,
    ...(draft.baselineModules ? { baselineModules: draft.baselineModules } : {}),
    activeFile: draft.activeFile,
    ...(draft.gistOwner ? { gistOwner: draft.gistOwner } : {}),
  });
}

/** A clean window is reloaded from its source. Throws if that fails, so the window isn't replaced by a template. */
async function docFromSession(entry: SessionEntry): Promise<Doc> {
  const stored = entry.fiddle;
  const context: LoadContext = { version: stored.version, modules: stored.modules };
  const origin = stored.origin;
  let loaded: LoadedFiddle;
  if (stored.source.localPath) {
    // A folder load says `local`; a saved untrusted fiddle stays untrusted until approved.
    const folder = stored.source.localPath;
    loaded = withFolderTrust(folder, await loadFolder(folder, context), origin);
  } else if (stored.source.gistId) {
    // A private gist loads with the restored token.
    await requireDeps().github.whenReady();
    loaded = await loadGist(github(), stored.source.gistId, stored.source.gistRevision, {
      context,
      confirmAddFile: (name) => Promise.resolve(stored.fileNames.includes(name)),
    });
  } else if (origin.kind === 'electron') {
    loaded = await loadElectronExample(github(), templates, origin.tag, origin.path);
  } else if (stored.templateName === TEST_TEMPLATE) {
    loaded = await newTest(templates, stored.version);
  } else if (stored.templateName && findExample(stored.templateName)) {
    loaded = await loadShowMe(staticDir(), stored.templateName, context);
  } else {
    loaded = await newFiddle(templates, stored.version);
  }
  // The session keeps the order the user gave the tabs, and which files were hidden.
  const files = orderFiles(loaded.fiddle.files, stored.fileNames);
  const fiddle: Fiddle = {
    ...loaded.fiddle,
    files,
    version: stored.version,
    modules: stored.modules,
    hidden: stored.hidden.filter((name) => Object.hasOwn(files, name)),
  };
  return createDoc(fiddle, entry.name, {
    activeFile: entry.activeFile,
    ...(entry.gistOwner ? { gistOwner: entry.gistOwner } : {}),
  });
}

interface OpenWindowOptions {
  windowId?: string;
  doc?: Doc;
  layout?: WindowLayout;
}

/** Opens a window for `doc`, or for a new fiddle from the default template. Returns its ID. */
export async function openFiddleWindow(options: OpenWindowOptions = {}): Promise<string> {
  if (!deps)
    throw new FiddleError(ErrorCode.unavailable, 'Documents are not initialized');
  const windowId = options.windowId ?? randomUUID();
  let doc = options.doc;
  if (!doc) {
    const loaded = await newFiddle(templates, defaultVersion());
    doc = createDoc(loaded.fiddle, loaded.name);
  }
  docs.set(windowId, doc);
  lastFocused = windowId;
  try {
    await deps.createWindow(windowId, {
      title: titleOf(doc),
      view: 'editor',
      fiddle: toFiddleState(doc),
      layout: options.layout ?? DEFAULT_LAYOUT,
    });
  } catch (error) {
    // A window that fails to start destroys itself. Its doc goes now, so the
    // `destroyed` handler leaves the session and the draft on disk alone.
    docs.delete(windowId);
    if (lastFocused === windowId) lastFocused = docs.keys().next().value;
    throw error;
  }
  if (docs.has(windowId)) commit(windowId, doc);
  return windowId;
}

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
    void withErrorDialog(windowId, async () => {
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
    });
  });
  // A folder dropped on the page navigates to its file:// URL; open it instead.
  // Only local paths: a UNC path or another host would reach out over the network.
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) return;
    event.preventDefault();
    const target = localPathFromFileUrl(url);
    if (target === undefined) {
      log.warn('refused a dropped file URL that is not local', url);
      return;
    }
    void withErrorDialog(windowId, async () => {
      if (!(await fs.stat(target)).isDirectory())
        throw new FiddleError(
          ErrorCode.invalidArgument,
          td('notAFolder', { path: target }),
        );
      await openFolderIn(windowId, target);
    });
  });
  contents.once('destroyed', () => onDestroyed(windowId));
}

function onDestroyed(windowId: string): void {
  if (!docs.has(windowId)) return;
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
    if (response !== 0) {
      cancelRelaunch();
      return;
    }
    finish();
    // A later turn: a prompt answered at once would otherwise quit inside this
    // `before-quit` dispatch, which Electron then treats as cancelled.
    setImmediate(() => app.quit());
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

function commit(
  windowId: string,
  doc: Doc,
  renamed?: { from: string; to: string },
): number {
  const previous = docs.get(windowId);
  docs.set(windowId, doc);
  const title = titleOf(doc);
  const patch: Partial<Pick<WindowState, 'fiddle' | 'title' | 'layout'>> = {
    fiddle: toFiddleState(doc),
    title,
  };
  // Split view: a newly focused file takes over the focused pane, and hidden or removed files leave theirs.
  const layout = hub().getWindow(windowId)?.layout;
  if (layout) {
    const panes = followActiveFile(
      renamed ? renamePane(layout.panes, renamed.from, renamed.to) : layout.panes,
      previous?.activeFile ?? null,
      doc.activeFile,
      visibleFileNames(doc.fiddle),
    );
    if (panes !== layout.panes) patch.layout = { ...layout, panes: [...panes] };
  }
  const rev = hub().updateWindow(windowId, patch);
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

/** A renamed file keeps its pane, focused or not. */
export function renameFile(windowId: string, from: string, to: string): number {
  return commit(windowId, docRenameFile(requireDoc(windowId), from, to), { from, to });
}

/** `EditFile`: most edits change only the mirror, so the store is pushed only when the dirty files change. */
export function editFile(
  windowId: string,
  name: string,
  text: string,
  fiddleRev: number,
): number {
  const doc = requireDoc(windowId);
  const next = applyEdit(doc, name, text, fiddleRev);
  if (!next || next === doc) return revOf(windowId);
  if (
    isDirty(next) !== isDirty(doc) ||
    dirtyFileNames(next).join('\n') !== dirtyFileNames(doc).join('\n')
  ) {
    return commit(windowId, next);
  }
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

export function getFiddle(windowId: string): Fiddle {
  return requireDoc(windowId).fiddle;
}

/** The window's whole document: its fiddle, last saved files and `fiddleRev`. Never mutate it. */
export function getDoc(windowId: string): Doc {
  return requireDoc(windowId);
}

export function getFiddleFiles(windowId: string): FileMap {
  return { ...requireDoc(windowId).fiddle.files };
}

export function getTemplate(version: VersionRef): Promise<FileMap> {
  return templates.getTemplate(version.kind === 'release' ? version.version : undefined);
}

export function currentTemplateName(windowId: string): string | undefined {
  return docs.get(windowId)?.fiddle.templateName;
}

/** Sets the window's Electron version. An unedited default template is replaced with the new version's template. */
export async function setFiddleVersion(
  windowId: string,
  versionRef: VersionRef,
): Promise<number> {
  const doc = requireDoc(windowId);
  if (isUneditedTemplate(doc)) {
    try {
      const loaded = await newFiddle(templates, versionRef);
      if (docs.get(windowId) === doc)
        return commit(windowId, createDoc(loaded.fiddle, doc.name, { previous: doc }));
    } catch (error) {
      log.warn('could not load the template for the new version', error);
    }
  }
  const current = requireDoc(windowId);
  return commit(windowId, {
    ...current,
    fiddle: { ...current.fiddle, version: versionRef },
  });
}

/** Module changes mark the fiddle dirty, except `normalized` ones (a loaded `*` resolved to a version). */
export function setFiddleModules(
  windowId: string,
  modules: Record<string, string>,
  normalized = false,
): number {
  return updateDoc(windowId, (doc) => docSetModules(doc, modules, normalized));
}

/** What was sent to the gist, and the `loadRev` of the fiddle it came from. */
export interface PublishedSnapshot {
  files: FileMap;
  modules: Readonly<Record<string, string>>;
  loadRev: number;
}

/**
 * After publishing: links the gist, unlinks the folder, and makes what was sent the saved state, so an
 * edit made while the request was in flight (a file added, renamed or removed too) stays unsaved.
 * Does nothing if another fiddle has taken the window.
 */
export function markPublished(
  windowId: string,
  gist: { id: string; revision?: string; owner?: string | null },
  sent: PublishedSnapshot,
): number {
  const doc = docs.get(windowId);
  if (!doc || doc.loadRev !== sent.loadRev) return revOf(windowId);
  return commit(windowId, {
    ...doc,
    baseline: sent.files,
    baselineModules: sent.modules,
    ...(gist.owner ? { gistOwner: gist.owner } : {}),
    fiddle: {
      ...doc.fiddle,
      source: {
        gistId: gist.id,
        ...(gist.revision ? { gistRevision: gist.revision } : {}),
      },
    },
  });
}

/** Deleting the gist unlinks it and marks the fiddle unsaved. */
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

/** `fiddle` is the approved fiddle: callers run it, not the window's current one. */
type TrustResult =
  | { approved: true; allowScripts: boolean; fiddle: Fiddle }
  | { approved: false; allowScripts: false };

const REGISTRY_TIMEOUT_MS = 5000;

/** Modules with install scripts, as `name@version`. If the registry can't tell, every module is listed. */
async function modulesWithInstallScripts(
  modules: Readonly<Record<string, string>>,
): Promise<string[]> {
  if (Object.keys(modules).length === 0) return [];
  try {
    const { npm } = requireDeps();
    const found = await findInstallScripts(
      modules,
      (name, signal) => npm.packument(name, signal),
      AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    );
    return found.map((p) => `${p.name}@${p.version}`);
  } catch (error) {
    log.warn('could not check modules for install scripts', error);
    return Object.keys(modules);
  }
}

/** The modules an approval has to list: none for a trusted origin or an approval that already allowed scripts. */
export async function installScriptPackages(windowId: string): Promise<string[]> {
  const doc = requireDoc(windowId);
  if (!isUntrustedOrigin(doc.fiddle.origin) || (isTrusted(doc) && doc.approvedScripts))
    return [];
  return modulesWithInstallScripts(doc.fiddle.modules);
}

/**
 * Approves the fiddle's origin before it runs code, with the native trust dialog if it is untrusted.
 * The approval is bound to the origin: a fiddle swapped in later, or while the dialog is open, needs
 * its own. `requireScripts` asks again when an earlier approval left install scripts off.
 */
export async function ensureTrusted(
  windowId: string,
  operation: CodeExecutingOperation,
  options: {
    packagesWithInstallScripts?: readonly string[];
    requireScripts?: boolean;
  } = {},
): Promise<TrustResult> {
  const doc = requireDoc(windowId);
  const origin = doc.fiddle.origin;
  if (!isUntrustedOrigin(origin))
    return { approved: true, allowScripts: true, fiddle: doc.fiddle };
  log.info('trust check', operation, formatOrigin(origin));
  if (
    !needsApproval(origin, doc.approvedOrigin) &&
    (doc.approvedScripts || !options.requireScripts)
  ) {
    return {
      approved: true,
      allowScripts: doc.approvedScripts ?? false,
      fiddle: doc.fiddle,
    };
  }
  const packages =
    options.packagesWithInstallScripts ??
    (await modulesWithInstallScripts(doc.fiddle.modules));
  const dependencies = Object.entries(doc.fiddle.modules).map(
    ([name, spec]) => `${name}@${spec}`,
  );
  const result = await messageBox(windowId, {
    type: 'warning',
    message: td('trustMessage'),
    detail: [
      td('trustDetail'),
      '',
      td('detailOrigin', { origin: formatOrigin(origin) }),
      td('detailFiles', {
        files: listOrNone(Object.keys(doc.fiddle.files).map((name) => dialogText(name))),
      }),
      td('detailDependencies', { dependencies: listOrNone(dependencies) }),
    ].join('\n'),
    buttons: [td('trustContinue'), td('cancel')],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    ...(packages.length > 0
      ? {
          checkboxLabel: td('trustAllowScripts', { packages: packages.join(', ') }),
          checkboxChecked: false,
        }
      : {}),
  });
  const latest = docs.get(windowId);
  if (result.response !== 0 || !latest || latest.fiddle.origin !== origin)
    return { approved: false, allowScripts: false };
  commit(windowId, {
    ...latest,
    approvedOrigin: formatOrigin(origin),
    approvedScripts: result.checkboxChecked,
  });
  const folder = latest.fiddle.source.localPath;
  if (folder !== undefined) rememberFolderTrust(folder, undefined);
  return { approved: true, allowScripts: result.checkboxChecked, fiddle: latest.fiddle };
}

/** A run, package or make is going, or a bisect: its window keeps its fiddle until it stops. */
function isBusy(windowId: string): boolean {
  const run = deps?.hub.getWindow(windowId)?.run;
  return (
    run !== undefined &&
    (run.status !== 'ready' || (run.bisect !== null && run.bisect.result === null))
  );
}

function contextOf(doc: Doc | undefined): LoadContext {
  return doc
    ? { version: doc.fiddle.version, modules: doc.fiddle.modules }
    : { version: defaultVersion(), modules: {} };
}

async function confirmReplace(windowId: string): Promise<boolean> {
  const doc = docs.get(windowId);
  if (!doc || !isDirty(doc)) return true;
  return confirm(windowId, {
    type: 'warning',
    message: td('replaceMessage'),
    detail: td('replaceDetail', { name: doc.name }),
    ok: td('discard'),
    defaultId: 1,
  });
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
  // A run, bisect, package or make keeps its fiddle: stop it before loading another here.
  if (isBusy(windowId)) {
    await messageBox(windowId, {
      type: 'info',
      message: td('busyMessage'),
      detail: td('busyDetail'),
    });
    return revOf(windowId);
  }
  if (!(await confirmReplace(windowId))) return revOf(windowId);
  const before = docs.get(windowId);
  const loaded = await load(contextOf(before));
  let current = docs.get(windowId);
  if (!before || !current) return 0;
  // Something started meanwhile: the new fiddle gets its own window.
  if (isBusy(windowId)) {
    const id = await openFiddleWindow({ doc: docFromLoaded(loaded) });
    showWarnings(id, loaded.warnings);
    return revOf(windowId);
  }
  // Text typed while the load was running was not part of what the user agreed to discard.
  if (!sameFiles(current.fiddle.files, before.fiddle.files)) {
    if (!(await confirmReplace(windowId))) return revOf(windowId);
    current = docs.get(windowId);
    if (!current) return 0;
  }
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

export async function newFiddleIn(
  windowId: string | undefined,
  kind: 'template' | 'test',
): Promise<number> {
  return replaceIn(windowId, (context) =>
    kind === 'test'
      ? newTest(templates, context.version)
      : newFiddle(templates, context.version),
  );
}

export async function showMeIn(
  windowId: string | undefined,
  name: string,
): Promise<number> {
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

export async function loadGistIn(
  windowId: string,
  idOrUrl: string,
  revision?: string,
): Promise<number> {
  const id = getGistId(idOrUrl);
  if (!id)
    throw new FiddleError(ErrorCode.invalidArgument, td('notAGist', { input: idOrUrl }), {
      reason: 'invalid-gist-id',
    });
  return replaceIn(windowId, (context) =>
    loadGist(github(), id, revision, {
      context,
      confirmAddFile: askAddFile(windowId),
      isUsableVersion,
    }),
  );
}

/** A docs example's version goes through the versions service: the hidden-channel prompt, then `SetVersion`. */
function docsExampleLoaded(windowId: string): void {
  requireDeps().onDocsExampleLoaded?.(windowId);
}

function confirmDocsExample(
  windowId: string | undefined,
  version: string,
  examplePath: string,
): Promise<boolean> {
  const detail = [
    td('detailVersion', { version: dialogText(version) }),
    td('detailPath', { path: dialogText(examplePath) }),
    '',
    td('linkUntrusted'),
  ];
  return confirm(windowId, {
    message: td('linkDocsMessage'),
    detail: detail.join('\n'),
    ok: td('load'),
  });
}

/** Text dropped on the window counts only if it is a deep link or a gist URL. */
export async function openDropped(windowId: string, text: string): Promise<void> {
  const trimmed = text.trim().split(/\s+/)[0] ?? '';
  if (isDeepLink(trimmed)) {
    deepLinks.push(trimmed);
    return;
  }
  if (
    getGistId(trimmed) &&
    /^(https:\/\/gist\.github\.com\/|[0-9a-f]{32}$)/i.test(trimmed)
  ) {
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
export async function openFolderIn(
  windowId: string | undefined,
  dir?: string,
): Promise<void> {
  if (dir === undefined) {
    const picked = await pickFolder(windowId, {
      title: td('openFolderTitle'),
      buttonLabel: td('open'),
    });
    if (!picked) return;
    dir = picked;
  }
  const folder = path.resolve(dir);
  const findOpen = () =>
    [...docs].find(([, doc]) => samePath(doc.fiddle.source.localPath, folder));
  const open = findOpen();
  if (open) {
    focusWindow(open[0]);
    return;
  }
  await replaceIn(windowId, async (context) =>
    withFolderTrust(folder, await loadFolder(folder, context)),
  );
  // A declined replace prompt leaves the folder unopened.
  if (findOpen()) addRecentFolder(folder);
}

/** The files a save into the fiddle's own folder deletes because the fiddle no longer has them. */
function removedBySave(
  doc: Doc,
  dir: string,
  mode: 'save' | 'saveAs' | 'forge',
): string[] {
  return mode !== 'forge' && samePath(doc.fiddle.source.localPath, dir)
    ? removedFileNames(doc)
    : [];
}

/**
 * Save, Save as, or Save as Forge project. Resolves false if cancelled or
 * failed. A Forge project is an export: the window stays linked to what it was.
 */
export async function saveIn(
  windowId: string,
  mode: 'save' | 'saveAs' | 'forge',
): Promise<boolean> {
  const doc = requireDoc(windowId);
  let dir = doc.fiddle.source.localPath;
  if (mode !== 'save' || dir === undefined) {
    const picked = await pickFolder(windowId, {
      title: td('saveFolderTitle'),
      buttonLabel: td('save'),
      properties: ['createDirectory', 'promptToCreate'],
    });
    if (!picked) return false;
    dir = path.resolve(picked);
    // Exactly what the save replaces or deletes, `.gitignore` and emptied files included.
    const written = filesForSave(doc.fiddle, {
      name: getProjectName(dir),
      author: packageAuthor(),
      ...(mode === 'forge' ? { forge: forgeOptions(doc.fiddle) } : {}),
    });
    const existing = await findFilesToReplace(dir, {
      ...written,
      ...Object.fromEntries(removedBySave(doc, dir, mode).map((name) => [name, ''])),
    });
    if (
      existing.length > 0 &&
      !(await confirm(windowId, {
        type: 'warning',
        message: td('overwriteMessage', { folder: path.basename(dir) }),
        detail: td('overwriteDetail', { files: existing.join(', ') }),
        ok: td('replace'),
        defaultId: 1,
      }))
    ) {
      return false;
    }
  }

  const snapshot = requireDoc(windowId);
  const name = getProjectName(dir);
  const linked = samePath(snapshot.fiddle.source.localPath, dir);
  try {
    await saveToFolder(dir, snapshot.fiddle, {
      name,
      author: packageAuthor(),
      remove: removedBySave(snapshot, dir, mode),
      ...(mode === 'forge' ? { forge: forgeOptions(snapshot.fiddle) } : {}),
    });
  } catch (error) {
    await showError(windowId, td('saveFailed'), error);
    return false;
  }

  // A saved untrusted fiddle stays untrusted when the folder is opened again, until it's approved.
  rememberFolderTrust(dir, isTrusted(snapshot) ? undefined : snapshot.fiddle.origin);
  if (mode === 'forge') return true;

  const latest = docs.get(windowId);
  if (latest) {
    // Saving to a new folder unlinks the gist.
    const source = linked
      ? { ...latest.fiddle.source, localPath: dir }
      : { localPath: dir };
    const { templateName: _saved, ...fiddle } = latest.fiddle;
    commit(windowId, {
      ...latest,
      name,
      baseline: snapshot.fiddle.files,
      baselineModules: snapshot.fiddle.modules,
      fiddle: { ...fiddle, source },
    });
  }
  addRecentFolder(dir);
  return true;
}

/** "Save as Forge project": the release, or a local build's path. */
function forgeOptions(fiddle: Fiddle) {
  return forgeOptionsFor(forgeElectronFor(fiddle.version, requireDeps().versions));
}

function untrustedFolderOrigin(dir: string): FiddleOrigin | undefined {
  const folders = stateStore?.get().untrustedFolders ?? {};
  const key = Object.keys(folders).find((d) => samePath(d, dir));
  return key === undefined ? undefined : folders[key];
}

/** Remembers a folder's untrusted origin, or forgets it (`undefined`) once approved or saved over by a trusted fiddle. */
function rememberFolderTrust(dir: string, origin: FiddleOrigin | undefined): void {
  if (!stateStore || (origin === undefined && untrustedFolderOrigin(dir) === undefined))
    return;
  stateStore.set((prev) => {
    const kept = Object.entries(prev.untrustedFolders ?? {}).filter(
      ([d]) => !samePath(d, dir),
    );
    return {
      ...prev,
      untrustedFolders: Object.fromEntries(
        origin ? [...kept, [path.resolve(dir), origin]] : kept,
      ),
    };
  });
}

/** A folder load says `local`; a remembered untrusted origin (or, on restore, the session's) wins. */
function withFolderTrust(
  dir: string,
  loaded: LoadedFiddle,
  sessionOrigin?: FiddleOrigin,
): LoadedFiddle {
  const origin = restoredOrigin(
    loaded.fiddle.origin,
    untrustedFolderOrigin(dir),
    sessionOrigin,
  );
  return origin === loaded.fiddle.origin
    ? loaded
    : { ...loaded, fiddle: { ...loaded.fiddle, origin } };
}

function packageAuthor(): string | undefined {
  return deps?.hub.app.settings.packageAuthor || osUserName() || undefined;
}

export function recentFolders(): string[] {
  return stateStore?.get().recentFolders ?? [];
}

function addRecentFolder(dir: string): void {
  app.addRecentDocument(dir);
  getStateStore().set((prev) => ({
    ...prev,
    recentFolders: [dir, ...prev.recentFolders.filter((d) => !samePath(d, dir))].slice(
      0,
      RECENT_LIMIT,
    ),
  }));
}

export function clearRecentFolders(): void {
  app.clearRecentDocuments();
  getStateStore().set((prev) => ({ ...prev, recentFolders: [] }));
}

/** Focused window if it has no unsaved changes and nothing running; otherwise the link opens in a new window. */
function linkTarget(): string | undefined {
  const id = lastFocused;
  const doc = id === undefined ? undefined : docs.get(id);
  return id !== undefined && doc && !isDirty(doc) && !isBusy(id) ? id : undefined;
}

async function handleDeepLink(url: string): Promise<void> {
  // A newer link replaces a private gist still waiting for sign-in.
  stopSignInRetry?.();
  stopSignInRetry = undefined;
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
      const gist = await github().loadGist(link.id, link.revision);
      const detail = gistLinkDetail(link, gist, gistDependencies(gist), td);
      if (
        !(await confirm(target, {
          message: td('linkGistMessage'),
          detail,
          ok: td('load'),
        }))
      )
        return;
      // Exactly the revision shown in the prompt is loaded.
      loaded = await fiddleFromGist(gist, {
        context: contextOf(target ? docs.get(target) : undefined),
        confirmAddFile: askAddFile(target),
        isUsableVersion,
      });
    } else {
      if (!(await confirmDocsExample(target, link.version, link.path))) return;
      loaded = await loadElectronExample(github(), templates, link.tag, link.path);
    }
    const current = target === undefined ? undefined : docs.get(target);
    let loadedIn: string;
    if (target !== undefined && current && !isDirty(current) && !isBusy(target)) {
      commit(target, docFromLoaded(loaded, current));
      loadedIn = target;
    } else {
      loadedIn = await openFiddleWindow({ doc: docFromLoaded(loaded) });
    }
    showWarnings(loadedIn, loaded.warnings);
    if (link.kind !== 'gist') docsExampleLoaded(loadedIn);
  } catch (error) {
    if (
      link.kind === 'gist' &&
      shouldOfferSignIn(error, Boolean(hub().app.githubLogin))
    ) {
      const host = target ?? lastFocused;
      await withErrorDialog(host, () => offerSignIn(host, url));
      return;
    }
    await showError(target, td('loadFailed'), error);
  }
}

let stopSignInRetry: (() => void) | undefined;

/** Asks to sign in for a gist link that may be private, then handles the link again once a login is set. */
async function offerSignIn(windowId: string | undefined, url: string): Promise<void> {
  if (
    !(await confirm(windowId, {
      message: td('linkSignInMessage'),
      detail: td('linkSignInDetail'),
      ok: td('signIn'),
    }))
  ) {
    return;
  }
  // With every window closed (macOS) there is no window to show the sign-in dialog in.
  const id = getWindow(windowId) ? windowId : await openFiddleWindow();
  const win = getWindow(id);
  if (!win) return;
  const stop = hub().onChange((change) => {
    if (change.store !== 'app' || !hub().app.githubLogin) return;
    stop();
    stopSignInRetry = undefined;
    deepLinks.push(url);
  });
  stopSignInRetry = stop;
  // A new window only listens for commands once its page is ready, which is when it is shown.
  if (id !== windowId && !win.isVisible())
    win.once('show', () => sendWindowCommand(id, 'gist.signIn'));
  else sendWindowCommand(id, 'gist.signIn');
}

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
  try {
    draftStore.write({
      windowId,
      savedAt: new Date().toISOString(),
      name: doc.name,
      fiddle: storeFiddle(doc.fiddle),
      baseline: doc.baseline,
      baselineModules: { ...doc.baselineModules },
      activeFile: doc.activeFile,
      ...(doc.gistOwner ? { gistOwner: doc.gistOwner } : {}),
    });
    draftsOnDisk.add(windowId);
  } catch (error) {
    log.warn('could not write a draft', windowId, error);
  }
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
  const open = [...docs].map(([windowId, doc]) => {
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
  return [...open, ...unrestored];
}

function saveSessionNow(): void {
  if (!sessionReady || sessionFrozen || !stateStore) return;
  clearTimeout(sessionTimer);
  sessionTimer = undefined;
  const sessions = sessionEntries();
  stateStore.set((prev) => ({ ...prev, sessions }));
}

function scheduleSessionSave(): void {
  if (!sessionReady || sessionFrozen || sessionTimer) return;
  sessionTimer = setTimeout(saveSessionNow, 1000);
}

function listOrNone(items: readonly string[]): string {
  return items.length > 0 ? items.join(', ') : td('none');
}

function errorDetail(error: unknown): string {
  const e = FiddleError.from(error);
  const localized = localizeError(e);
  if (localized !== e) return localized.message;
  return e.code === ErrorCode.network ? td('offline') : e.message;
}

async function showError(
  windowId: string | undefined,
  title: string,
  error: unknown,
): Promise<void> {
  log.warn(title, error);
  await messageBox(windowId, {
    type: 'error',
    message: title,
    detail: errorDetail(error),
  });
}

/** Runs a menu action and shows a native error if it fails. */
export async function withErrorDialog(
  windowId: string | undefined,
  action: () => Promise<unknown>,
): Promise<void> {
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
        return td('warnModules', {
          modules: warning.modules.map((m) => `${m.name}@${m.spec}`).join(', '),
        });
    }
  });
  void messageBox(windowId, {
    type: 'warning',
    message: td('loadWarnings'),
    detail: lines.join('\n'),
  });
}
