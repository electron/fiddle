/**
 * The two EIPC stores. Main owns them and is their only writer (through the
 * StateHub); renderers read them and request changes through methods.
 *
 * These zod schemas are the single source of truth: the EIPC schema imports
 * them with `zod_reference`, so every pushed value is validated, and the
 * TypeScript types below are inferred from them.
 *
 * Keep stores small. Bulk data (fiddle text, release lists, console output) is
 * fetched with a method; a store only carries a revision number for it.
 */
import { z } from 'zod';

// The CSP enforces Trusted Types, and zod's JIT probe (`new Function`) is reported
// as a violation even though zod catches it. Every schema is parsed after this runs.
z.config({ jitless: true });

import { VersionRefSchema } from '../fiddle/fiddle';
import { settingsSchema, storageNoticeSchema, themeSummarySchema } from './settings';

export const platformSchema = z.enum(['darwin', 'win32', 'linux']);
export type Platform = z.infer<typeof platformSchema>;

/**
 * The OS material under the window chrome (Lucent "Glass on real windows").
 * `none` means the renderer adds `lu-no-material` to `<html>`.
 */
export const materialSchema = z.enum(['vibrancy', 'acrylic', 'none']);
export type Material = z.infer<typeof materialSchema>;

/** Shared state: the same value in every window. */
export const appStateSchema = z.object({
  /** Increases by one with every change main applies. */
  rev: z.number().int().nonnegative(),
  /** Active UI locale, e.g. `en`. */
  locale: z.string(),
  platform: platformSchema,
  material: materialSchema,
  // Settings slice: effective settings (see src/shared/settings.ts).
  settings: settingsSchema,
  /** Custom themes in `<userData>/themes/`. The data is fetched with `Settings.GetTheme`. */
  themes: z.array(themeSummarySchema),
  /** Whether Monaco should use `accessibilitySupport: 'on'`, resolved from the setting and the OS. */
  screenReaderActive: z.boolean(),
  /** Corrupt or too-new data files; shown as toasts until dismissed. */
  storageNotices: z.array(storageNoticeSchema),
  /** OS high contrast (`nativeTheme.shouldUseHighContrastColors`): Lucent shows its high-contrast variant (§10). */
  highContrast: z.boolean().optional(),
  // Versions and run slice: install state, local builds and `releasesRev`.
  versions: z.lazy(() => versionsStateSchema).optional(),
  // Gists slice: the signed-in GitHub login. The token itself never leaves main.
  githubLogin: z.string().optional(),
});
export type AppState = z.infer<typeof appStateSchema>;

/** Per-window state. Each window only ever sees its own. */
export const windowStateSchema = z.object({
  /** Increases by one with every change main applies. */
  rev: z.number().int().nonnegative(),
  /** UUID assigned by main. Renderers never send it; handlers close over it. */
  windowId: z.uuid(),
  title: z.string(),
  // Documents slice: see "Window store fiddle contract" in PROGRESS.md.
  view: z.lazy(() => windowViewSchema),
  fiddle: z.lazy(() => fiddleStateSchema),
  layout: z.lazy(() => windowLayoutSchema),
  // Versions and run slice: run, package and bisect status. Absent means ready.
  run: z.lazy(() => runStateSchema).optional(),
  // Versions and run slice: the last version fallback or failed download, shown as a toast, then dismissed.
  versionNotice: z.lazy(() => versionNoticeSchema).nullable().optional(),
});
export type WindowState = z.infer<typeof windowStateSchema>;

export const versionNoticeSchema = z.object({
  /** Increases with every notice, so each is shown once. */
  id: z.number().int().positive(),
  message: z.string(),
});
export type VersionNotice = z.infer<typeof versionNoticeSchema>;

// ---------------------------------------------------------------------------
// Documents slice: the fiddle part of the Window store.

/** A fiddle's files, name → text. Fetched with `Documents.GetFiles`, never stored. */
export const fileMapSchema = z.record(z.string(), z.string());
export type FileMapValue = z.infer<typeof fileMapSchema>;

export const windowViewSchema = z.enum(['editor', 'settings']);
export type WindowView = z.infer<typeof windowViewSchema>;

export const windowLayoutSchema = z.object({
  sidebar: z.boolean(),
  /** The file shown in the second editor pane, or null when not split. */
  split: z.string().nullable(),
  consoleHeight: z.number().nonnegative(),
  sidebarWidth: z.number().nonnegative(),
  /** View > Toggle console, or its splitter dragged closed. Runs, package and make open it (§17.7). */
  consoleVisible: z.boolean().default(true),
});
export type WindowLayout = z.infer<typeof windowLayoutSchema>;

export const DEFAULT_LAYOUT: WindowLayout = {
  sidebar: true,
  split: null,
  consoleHeight: 160,
  sidebarWidth: 228,
  consoleVisible: true,
};

export const fiddleSourceStateSchema = z.object({
  /** The folder the fiddle is saved in. */
  localPath: z.string().optional(),
  gistId: z.string().optional(),
  gistRevision: z.string().optional(),
  gistOwner: z.string().optional(),
  /** Set for templates and Show Me examples, e.g. `template`, `test`, `BrowserWindow`. */
  templateName: z.string().optional(),
  /** Trust origin: `local`, `example`, `gist:<owner>/<id>@<sha>` or `electron:<tag>/<path>`. */
  origin: z.string(),
  /** False while the fiddle has a remote origin the user hasn't approved. */
  trusted: z.boolean(),
});
export type FiddleSourceState = z.infer<typeof fiddleSourceStateSchema>;

export const versionRefSchema = VersionRefSchema;

export const fiddleStateSchema = z.object({
  source: fiddleSourceStateSchema,
  /** Display name: the folder name, the gist description or the example name. */
  name: z.string(),
  versionRef: versionRefSchema,
  modules: z.record(z.string(), z.string()),
  /** Every file in display order. Text is fetched with `Documents.GetFiles`. */
  files: z.array(z.object({ name: z.string(), visible: z.boolean() })),
  activeFile: z.string().nullable(),
  /** Increases whenever a new fiddle replaces the editor mirror. */
  fiddleRev: z.number().int().nonnegative(),
  /** Some file differs from the last save. */
  dirty: z.boolean(),
  /** The files whose text differs from the last save, in display order. */
  dirtyFiles: z.array(z.string()),
});
export type FiddleState = z.infer<typeof fiddleStateSchema>;

// ---------------------------------------------------------------------------
// App UX slice: npm search results and version lists. Fetched with `Modules`
// methods, never stored.

export const packageSearchResultsSchema = z.array(
  z.object({ name: z.string(), version: z.string(), description: z.string() }),
);
export type PackageSearchResults = z.infer<typeof packageSearchResultsSchema>;

export const packageVersionsSchema = z.object({
  /** The `latest` dist-tag, or the newest stable version. Null if nothing is published. */
  latest: z.string().nullable(),
  /** Every published version, newest first. */
  versions: z.array(z.string()),
});
export type PackageVersions = z.infer<typeof packageVersionsSchema>;

// ---------------------------------------------------------------------------
// Versions and run slice. `App.versions` holds install state and local builds;
// `Window.run` holds run, package and bisect status. Release lists, console
// output and editor types are fetched with `Versions` and `Run` methods.

export type VersionRefValue = z.infer<typeof versionRefSchema>;

export const installStateSchema = z.enum([
  'missing',
  'downloading',
  'downloaded',
  'installing',
  'installed',
]);
export type InstallStateValue = z.infer<typeof installStateSchema>;

export const localBuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  /** False when the folder no longer holds an Electron binary. */
  available: z.boolean(),
});
export type LocalBuild = z.infer<typeof localBuildSchema>;

export const versionsStateSchema = z.object({
  /** Bumped when the release list changes. */
  releasesRev: z.number().int().nonnegative(),
  /** Every version that isn't `missing`. `percent` (0–100) while downloading. */
  installs: z.record(
    z.string(),
    z.object({ state: installStateSchema, percent: z.number().optional() }),
  ),
  localBuilds: z.array(localBuildSchema),
  /** "Download all" is in progress. */
  downloadingAll: z.boolean(),
  /** The processor architecture, e.g. `arm64`. */
  arch: z.string(),
});
export type VersionsState = z.infer<typeof versionsStateSchema>;

export const releaseRowSchema = z.object({
  version: z.string(),
  date: z.string(),
  /** The bundled Node version. */
  node: z.string(),
  /** Older than the oldest supported major. */
  obsolete: z.boolean(),
  /** False when this OS or processor can't run it. */
  supported: z.boolean(),
});
export type ReleaseRow = z.infer<typeof releaseRowSchema>;
export const releaseListSchema = z.array(releaseRowSchema);
export type ReleaseList = z.infer<typeof releaseListSchema>;
export const versionListSchema = z.array(z.string().min(1).max(100)).max(5000);
export type VersionList = z.infer<typeof versionListSchema>;

export const sourceLocationSchema = z.object({
  /** A fiddle file name, e.g. `renderer.js`. */
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive().optional(),
});
export type SourceLocation = z.infer<typeof sourceLocationSchema>;

/** An uncaught error in the running fiddle, mapped back to a fiddle file. */
export const runtimeErrorSchema = sourceLocationSchema.extend({
  process: z.enum(['main', 'preload', 'renderer']),
  /** `TypeError`, `Error`, … */
  name: z.string(),
  message: z.string(),
});
export type RuntimeErrorValue = z.infer<typeof runtimeErrorSchema>;

export const bisectStateSchema = z.object({
  good: z.string(),
  bad: z.string(),
  auto: z.boolean(),
  /** The version being tested; null once finished. */
  current: z.string().nullable(),
  /** Set when finished: the last good and first bad version. */
  result: z.object({ good: z.string(), bad: z.string() }).nullable(),
});
export type BisectState = z.infer<typeof bisectStateSchema>;

export const runStateSchema = z.object({
  /**
   * §17.6 "Run/Stop control states": `checking` (pre-run checks), `downloading`
   * and `unzipping` (installing the version), `installing` (modules), then
   * `starting` and `running`.
   */
  status: z.enum(['ready', 'checking', 'downloading', 'unzipping', 'installing', 'starting', 'running']),
  /** What the status is about: the fiddle, or Forge package or make. */
  task: z.enum(['run', 'package', 'make']),
  /** Download progress, 0–100, while `downloading`. */
  percent: z.number().min(0).max(100).optional(),
  /** The Electron version of the current or last run, e.g. `43.0.0` or a local build's name. */
  version: z.string().optional(),
  result: z.enum(['success', 'failure', 'invalid']).optional(),
  /** Runtime errors of the current or last run, at most 50. */
  errors: z.array(runtimeErrorSchema),
  /** Console lines with `seq` at or below this were cleared. */
  clearedSeq: z.number().int().nonnegative(),
  bisect: bisectStateSchema.nullable(),
});
export type RunState = z.infer<typeof runStateSchema>;

export const outputLineSchema = z.object({
  /** Increases by one per line in a window, never reused. */
  seq: z.number().int().nonnegative(),
  /** Epoch milliseconds. */
  time: z.number(),
  process: z.enum(['fiddle', 'main', 'renderer']),
  kind: z.enum(['log', 'system', 'warn', 'error']),
  text: z.string(),
  location: sourceLocationSchema.optional(),
});
export type OutputLine = z.infer<typeof outputLineSchema>;
export const outputLinesSchema = z.array(outputLineSchema);
export type OutputLines = z.infer<typeof outputLinesSchema>;

export const editorTypesSchema = z.object({
  /** The version the types belong to. */
  version: z.string(),
  /** `electron.d.ts`, or null when it couldn't be fetched. */
  electron: z.string().nullable(),
  /** `@types/node` files, path → text. Empty when unavailable. */
  node: z.record(z.string(), z.string()),
});
export type EditorTypes = z.infer<typeof editorTypesSchema>;
