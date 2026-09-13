/**
 * Command definitions, shared by main and the renderer. Every user action is a
 * command with an ID, an i18n label key (in the `main` namespace), an
 * accelerator per platform and an enablement predicate.
 *
 * Predicates are pure functions of the two stores: main evaluates them for
 * native menus, and renderers run the same code against their stores.
 * Handlers live in main (src/main/app-commands.ts).
 */
import type main from '../i18n/generated/en/main';
import type { AppState, Platform, WindowState } from './stores';

export type LabelKey = keyof typeof main;

/** One Electron accelerator for every platform, or a default plus per-platform overrides. */
export type Accelerator =
  string | ({ default: string } & Partial<Record<Platform, string>>);

/** `win` is undefined when no app window is focused (possible on macOS). */
export type Enablement = (app: AppState, win: WindowState | undefined) => boolean;

export interface CommandDefinition {
  label: LabelKey;
  accelerator?: Accelerator;
  enabled?: Enablement;
}

const hasWindow: Enablement = (_app, win) => win !== undefined;

export const commands = {
  'app.newWindow': {
    label: 'newWindow',
    accelerator: 'CmdOrCtrl+Shift+N',
  },
  'view.reload': {
    label: 'reload',
    // CmdOrCtrl+R runs and stops the fiddle (Lucent); see PROGRESS.md "Decisions".
    accelerator: 'CmdOrCtrl+Shift+R',
    enabled: hasWindow,
  },
  'view.toggleDevTools': {
    label: 'toggleDevTools',
    accelerator: 'CmdOrCtrl+Alt+I',
    enabled: hasWindow,
  },
  // Shell slice: view-state commands, sent to the window as `Window.Command`.
  'view.toggleSplit': {
    label: 'toggleSplit',
    accelerator: 'CmdOrCtrl+\\',
    enabled: hasWindow,
  },
  'view.toggleSidebar': {
    label: 'toggleSidebar',
    enabled: hasWindow,
  },
  'view.toggleConsole': {
    label: 'toggleConsole',
    enabled: hasWindow,
  },
  'editor.toggleSoftWrap': {
    label: 'toggleSoftWrap',
    enabled: hasWindow,
  },
  'editor.toggleMinimap': {
    label: 'toggleMinimap',
    enabled: hasWindow,
  },
  'editor.format': {
    label: 'formatDocument',
    accelerator: 'Shift+Alt+F',
    enabled: hasWindow,
  },
  // Documents slice: the File menu. Handlers in src/main/documents/commands.ts.
  'file.newFiddle': {
    label: 'newFiddle',
    accelerator: 'CmdOrCtrl+N',
  },
  'file.newTest': {
    label: 'newTest',
    accelerator: 'CmdOrCtrl+T',
  },
  'file.open': {
    label: 'openFolder',
    accelerator: 'CmdOrCtrl+O',
  },
  'file.save': {
    label: 'save',
    accelerator: 'CmdOrCtrl+S',
    enabled: hasWindow,
  },
  'file.saveAs': {
    label: 'saveAs',
    accelerator: 'CmdOrCtrl+Shift+S',
    enabled: hasWindow,
  },
  'file.saveAsForge': {
    label: 'saveAsForge',
    enabled: hasWindow,
  },
  'file.close': {
    label: 'closeWindow',
    accelerator: 'CmdOrCtrl+W',
    enabled: hasWindow,
  },
  // App UX slice: both are sent to the window as `Window.Command`.
  'app.commandPalette': {
    label: 'commandPalette',
    accelerator: 'CmdOrCtrl+Shift+P',
    enabled: hasWindow,
  },
  'help.showTour': {
    label: 'showTour',
    enabled: hasWindow,
  },
  // Settings slice: shows the settings page in the window (`Window.view`).
  'app.preferences': {
    label: 'preferences',
    accelerator: 'CmdOrCtrl+,',
    enabled: hasWindow,
  },
  // Gists slice: each opens a gist dialog in the window (`GitHub.OpenDialog`).
  'gist.publish': {
    label: 'publishToGist',
    enabled: hasWindow,
  },
  'gist.open': {
    label: 'openGist',
    enabled: hasWindow,
  },
  'gist.history': {
    label: 'showGistHistory',
    enabled: (_app, win) => win?.fiddle.source.gistId !== undefined,
  },
  // Versions and run slice. Handlers in src/main/run/commands.ts. F5 also
  // runs 'run.toggle' through a hidden menu item (src/main/menu.ts).
  'run.toggle': {
    label: 'runToggle',
    accelerator: 'CmdOrCtrl+R',
    enabled: hasWindow,
  },
  'run.package': {
    label: 'packageFiddle',
    enabled: (_app, win) => win !== undefined && (win.run?.status ?? 'ready') === 'ready',
  },
  'run.make': {
    label: 'makeFiddle',
    enabled: (_app, win) => win !== undefined && (win.run?.status ?? 'ready') === 'ready',
  },
  'bisect.toggle': {
    label: 'toggleBisect',
    accelerator: 'CmdOrCtrl+Shift+B',
    enabled: hasWindow,
  },
  // Platform slice: the Help menu. Handlers in src/main/platform/index.ts.
  'help.about': { label: 'aboutFiddle' },
  'help.openLogsFolder': { label: 'openLogsFolder' },
  'help.copyDiagnostics': { label: 'copyDiagnostics' },
  'help.fiddleRepository': { label: 'openFiddleRepository' },
  'help.electronRepository': { label: 'openElectronRepository' },
  'help.reportIssue': { label: 'reportIssue' },
} as const satisfies Record<string, CommandDefinition>;

export type CommandId = keyof typeof commands;

export const commandIds = Object.keys(commands) as CommandId[];

export function isCommandId(id: string): id is CommandId {
  return Object.hasOwn(commands, id);
}

export function getCommand(id: CommandId): CommandDefinition {
  return commands[id];
}

export function acceleratorFor(id: CommandId, platform: Platform): string | undefined {
  const accelerator = getCommand(id).accelerator;
  if (accelerator === undefined || typeof accelerator === 'string') return accelerator;
  return accelerator[platform] ?? accelerator.default;
}

export function isCommandEnabled(
  id: CommandId,
  app: AppState,
  win: WindowState | undefined,
): boolean {
  return getCommand(id).enabled?.(app, win) ?? true;
}
