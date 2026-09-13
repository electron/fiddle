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
    accelerator: 'CmdOrCtrl+R',
    enabled: hasWindow,
  },
  'view.toggleDevTools': {
    label: 'toggleDevTools',
    accelerator: 'CmdOrCtrl+Alt+I',
    enabled: hasWindow,
  },
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
