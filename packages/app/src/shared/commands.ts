/**
 * Every user action is a command with an i18n label key (in the `main`
 * namespace), an accelerator per platform and an enablement predicate. Predicates
 * are pure functions of the two stores, so main and the renderer agree.
 */
import type main from '../i18n/generated/en/main';
import type { AppState, Platform, WindowState } from './stores';

export type LabelKey = keyof typeof main;

/** One Electron accelerator for every platform, or a default plus per-platform overrides. */
export type Accelerator =
  string | ({ default: string } & Partial<Record<Platform, string>>);

/** `win` is undefined when no app window is focused (possible on macOS). */
export type Enablement = (app: AppState, win: WindowState | undefined) => boolean;

/** Where a keybinding applies. Scoped keybindings are dispatched by the renderer, never by the native menu. */
export type KeyContext = 'editor' | 'console' | 'running';
export const keyContexts: readonly KeyContext[] = ['editor', 'console', 'running'];

export interface CommandDefinition {
  /** The palette's and the keyboard settings' label. Menus may say what the command does now instead (Hide sidebar). */
  label: LabelKey;
  /** Default keybindings. Menus show the first; the renderer dispatches every one. */
  accelerator?: Accelerator | readonly Accelerator[];
  /** Where the default keybindings apply. Unset means everywhere. Menus never register a scoped keybinding. */
  context?: KeyContext;
  enabled?: Enablement;
  /** For developing Fiddle itself: enabled only while `App.dev` is set, and left out of the palette and Settings > Keyboard otherwise. */
  devOnly?: boolean;
}

const hasWindow: Enablement = (_app, win) => win !== undefined;
/** The tab row has at least two tabs (visible files). */
const hasTabs: Enablement = (_app, win) =>
  (win?.fiddle.files.filter((file) => file.visible).length ?? 0) > 1;

export const commands = {
  'app.newWindow': {
    label: 'newWindow',
    accelerator: 'CmdOrCtrl+Shift+N',
  },
  'view.reload': {
    label: 'reload',
    // CmdOrCtrl+R runs and stops the fiddle, so Reload takes Shift.
    accelerator: 'CmdOrCtrl+Shift+R',
    enabled: hasWindow,
  },
  'view.toggleDevTools': {
    label: 'toggleDevTools',
    accelerator: 'CmdOrCtrl+Alt+I',
    enabled: hasWindow,
  },
  'view.toggleSplit': {
    label: 'toggleSplit',
    accelerator: 'CmdOrCtrl+\\',
    enabled: hasWindow,
  },
  // Ctrl+Shift+PageUp/PageDown as in VS Code and Chrome; macOS laptops have no
  // Page keys, so Ctrl+Cmd+Left/Right, which Monaco leaves free.
  'editor.moveTabLeft': {
    label: 'moveTabLeft',
    accelerator: { default: 'Ctrl+Shift+PageUp', darwin: 'Ctrl+Cmd+Left' },
    enabled: hasTabs,
  },
  'editor.moveTabRight': {
    label: 'moveTabRight',
    accelerator: { default: 'Ctrl+Shift+PageDown', darwin: 'Ctrl+Cmd+Right' },
    enabled: hasTabs,
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
  'app.commandPalette': {
    label: 'commandPalette',
    // F1 too, as in Monaco, whose own quick command it replaces.
    accelerator: ['CmdOrCtrl+Shift+P', 'F1'],
    enabled: hasWindow,
  },
  'help.showTour': {
    label: 'showTour',
    enabled: hasWindow,
  },
  'app.preferences': {
    label: 'preferences',
    accelerator: 'CmdOrCtrl+,',
    enabled: hasWindow,
  },
  'gist.publish': {
    label: 'publishToGist',
    enabled: hasWindow,
  },
  'gist.open': {
    label: 'openGist',
    // Open folder plus Shift. In the editor it shadows Monaco's "Go to symbol".
    accelerator: 'CmdOrCtrl+Shift+O',
    enabled: hasWindow,
  },
  'gist.history': {
    label: 'showGistHistory',
    enabled: (app, win) =>
      app.settings.gistShowHistory && win?.fiddle.source.gistId !== undefined,
  },
  'run.toggle': {
    label: 'runToggle',
    accelerator: ['CmdOrCtrl+R', 'F5'],
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
  // Stops a running bisect; otherwise the window shows the range dialog.
  'bisect.toggle': {
    label: 'toggleBisect',
    accelerator: 'CmdOrCtrl+Shift+B',
    enabled: hasWindow,
  },
  'help.about': { label: 'aboutFiddle' },
  'help.openLogsFolder': { label: 'openLogsFolder' },
  'help.copyDiagnostics': { label: 'copyDiagnostics' },
  'help.fiddleRepository': { label: 'openFiddleRepository' },
  'help.electronRepository': { label: 'openElectronRepository' },
  'help.reportIssue': { label: 'reportIssue' },
  // Undo, redo and select all go to the focused Monaco editor through the
  // window; anywhere else they do what the native roles do. Always enabled,
  // so native dialogs keep them on macOS.
  'edit.undo': { label: 'undo', accelerator: 'CmdOrCtrl+Z' },
  'edit.redo': { label: 'redo', accelerator: 'Shift+CmdOrCtrl+Z' },
  'edit.selectAll': { label: 'selectAll', accelerator: 'CmdOrCtrl+A' },
  // In the Edit menu without its key: a scoped keybinding is the renderer's alone.
  'console.clear': {
    label: 'clearConsole',
    accelerator: 'CmdOrCtrl+K',
    context: 'console',
    enabled: hasWindow,
  },
  'editor.formatAll': {
    label: 'formatAll',
    enabled: hasWindow,
  },
  'editor.formatSelection': {
    label: 'formatSelection',
    context: 'editor',
    enabled: hasWindow,
  },
  'editor.goToDefinition': {
    label: 'goToDefinition',
    accelerator: 'F12',
    context: 'editor',
    enabled: hasWindow,
  },
  'editor.findReferences': {
    label: 'findReferences',
    accelerator: 'Shift+F12',
    context: 'editor',
    enabled: hasWindow,
  },
  // CmdOrCtrl+M is Minimize; Ctrl+Shift+M is Monaco's own macOS binding for
  // this and free everywhere.
  'editor.toggleTabFocus': {
    label: 'toggleTabFocus',
    accelerator: 'Ctrl+Shift+M',
    enabled: hasWindow,
  },
  // Font changes apply after a reload; Settings offers this next to them.
  'view.reloadAllWindows': { label: 'reloadAllWindows' },
  'dev.toggleMenuBar': { label: 'toggleMenuBar', devOnly: true },
  'dev.openGallery': { label: 'openComponentGallery', devOnly: true },
} as const satisfies Record<string, CommandDefinition>;

export type CommandId = keyof typeof commands;

/**
 * IDs main sends to a window as `Window.Command`: forwarded commands, plus
 * `gist.signIn`, which Documents sends to retry a private deep-linked gist.
 */
export type WindowCommandId = CommandId | 'gist.signIn';

export const commandIds = Object.keys(commands) as CommandId[];

export function isCommandId(id: string): id is CommandId {
  return Object.hasOwn(commands, id);
}

export function getCommand(id: CommandId): CommandDefinition {
  return commands[id];
}

function forPlatform(accelerator: Accelerator, platform: Platform): string {
  return typeof accelerator === 'string'
    ? accelerator
    : (accelerator[platform] ?? accelerator.default);
}

/** Every default keybinding of a command on this platform; the first is the menu's. */
export function acceleratorsFor(id: CommandId, platform: Platform): string[] {
  const accelerator = getCommand(id).accelerator;
  if (accelerator === undefined) return [];
  const list: readonly Accelerator[] = Array.isArray(accelerator)
    ? accelerator
    : [accelerator as Accelerator];
  return list.map((one) => forPlatform(one, platform));
}

/** The first default keybinding, the one menus show. */
export function acceleratorFor(id: CommandId, platform: Platform): string | undefined {
  return acceleratorsFor(id, platform)[0];
}

export function isCommandEnabled(
  id: CommandId,
  app: AppState,
  win: WindowState | undefined,
): boolean {
  const command = getCommand(id);
  if (command.devOnly && !app.dev) return false;
  return command.enabled?.(app, win) ?? true;
}

/** Whether the palette and Settings > Keyboard list the command: a dev-only one only in development builds. */
export function isCommandListed(
  id: CommandId,
  app: Pick<AppState, 'dev'> | undefined,
): boolean {
  return !getCommand(id).devOnly || app?.dev === true;
}
