/**
 * Context menus for app windows (REQUIREMENTS §17.14), built from the command
 * registry:
 * - everywhere: Cut, Copy and Paste (enabled by Chromium's edit flags), Run
 *   and Clear console, plus Inspect element in development builds;
 * - in the editor, also: go to definition, find references and the format
 *   commands, which main forwards to the window (`Window.Command`);
 * - in the console: Copy instead of Cut, Copy and Paste.
 *
 * The renderer says what was right-clicked with `Window.ReportContextMenu`
 * (src/renderer/features/commands/keybindings.ts). It sends that during the
 * DOM `contextmenu` event, so it arrives before Chromium's `context-menu`
 * event, which comes over the same IPC channel.
 */
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions, type WebContents } from 'electron';

import { commands, type CommandId, type LabelKey } from '../shared/commands';
import { effectiveAccelerator, focusContextSchema, type FocusContext } from '../shared/settings';
import { t } from './i18n';
import { log } from './log';
import type { Services } from './services';

const separator: MenuItemConstructorOptions = { type: 'separator' };

export interface ContextMenuInput {
  context: FocusContext;
  /** From the `context-menu` event's params. */
  editFlags: { canCut: boolean; canCopy: boolean; canPaste: boolean };
  /** Development builds add Inspect element. */
  dev: boolean;
  /** The menu item for a registry command: label, shortcut, enablement and click. */
  command(id: CommandId): MenuItemConstructorOptions;
  label(key: LabelKey): string;
  inspect(): void;
}

/** The context menu's template, in groups separated by separators. */
export function buildContextMenuTemplate(input: ContextMenuInput): MenuItemConstructorOptions[] {
  const { context, editFlags, command, label } = input;
  const copy: MenuItemConstructorOptions = { role: 'copy', label: label('copy'), enabled: editFlags.canCopy };
  const groups: MenuItemConstructorOptions[][] = [
    context === 'editor' ? [command('editor.goToDefinition'), command('editor.findReferences')] : [],
    context === 'console'
      ? [copy]
      : [
          { role: 'cut', label: label('cut'), enabled: editFlags.canCut },
          copy,
          { role: 'paste', label: label('paste'), enabled: editFlags.canPaste },
        ],
    context === 'editor' ? [command('editor.format'), command('editor.formatSelection')] : [],
    [command('run.toggle'), command('console.clear')],
    input.dev ? [{ label: label('inspectElement'), click: () => input.inspect() }] : [],
  ];
  return groups.filter((group) => group.length > 0).flatMap((group, index) => (index === 0 ? group : [separator, ...group]));
}

const contexts = new Map<string, FocusContext>();

/** `Window.ReportContextMenu`: what the next context menu in this window is over. */
export function reportContextMenu(windowId: string, context: FocusContext): void {
  contexts.set(windowId, context);
}

interface ClickParams {
  editFlags: ContextMenuInput['editFlags'];
  x: number;
  y: number;
}

/** Shows the context menu on right-click in an app window. */
export function attachContextMenu(windowId: string, contents: WebContents, { registry, hub, platform }: Services): void {
  const templateFor = (context: FocusContext, params: ClickParams) =>
    buildContextMenuTemplate({
      context,
      editFlags: params.editFlags,
      dev: !app.isPackaged,
      command: (id) => ({
        id,
        label: t(commands[id].label),
        accelerator: effectiveAccelerator(id, platform, hub.app.settings.keybindings),
        enabled: registry.isEnabled(id, windowId),
        click: () => {
          registry.run(id, { windowId }).catch((error: unknown) => log.error(`command ${id} failed`, error));
        },
      }),
      label: (key) => t(key),
      inspect: () => contents.inspectElement(params.x, params.y),
    });

  contents.on('context-menu', (_event, params) => {
    const context = contexts.get(windowId) ?? 'other';
    contexts.delete(windowId);
    const template = templateFor(context, params);
    dumpMenu(`context menu (${context})`, template);
    Menu.buildFromTemplate(template).popup({ window: BrowserWindow.fromWebContents(contents) ?? undefined });
  });
  contents.once('destroyed', () => contexts.delete(windowId));

  // With FIDDLE_DEV_MENU_DUMP=1, also log each context's menu once, without a right-click.
  if (isMenuDumpOn()) {
    contents.once('did-finish-load', () => {
      const params = { editFlags: { canCut: true, canCopy: true, canPaste: true }, x: 0, y: 0 };
      for (const context of focusContextSchema.options) dumpMenu(`context menu (${context})`, templateFor(context, params));
    });
  }
}

/** Labels, shortcuts, roles and state, one item per line: the dev log, and the application menu's rebuild check. */
export function describeMenu(template: readonly MenuItemConstructorOptions[], depth = 0): string[] {
  const indent = '  '.repeat(depth);
  return template.flatMap((item) => {
    if (item.type === 'separator') return [`${indent}---`];
    if (item.visible === false) return [];
    const notes = [
      item.accelerator && `[${String(item.accelerator)}]`,
      item.role && `(role ${item.role})`,
      item.checked && '(checked)',
      item.enabled === false && '(disabled)',
    ].filter(Boolean);
    const line = [`${indent}${item.label ?? item.role ?? ''}`, ...notes].join(' ');
    return [line, ...(Array.isArray(item.submenu) ? describeMenu(item.submenu, depth + 1) : [])];
  });
}

/** Dev runs only (`yarn start:xvfb`): FIDDLE_DEV_MENU_DUMP=1 logs menus, to check them headlessly. */
function isMenuDumpOn(): boolean {
  return import.meta.env.MODE !== 'production' && !app.isPackaged && process.env.FIDDLE_DEV_MENU_DUMP === '1';
}

/** Logs a menu as it's built, when FIDDLE_DEV_MENU_DUMP=1 in a dev run. */
export function dumpMenu(name: string, template: readonly MenuItemConstructorOptions[]): void {
  if (isMenuDumpOn()) log.info(`${name}:\n${describeMenu(template).join('\n')}`);
}
