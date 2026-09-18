/**
 * The keybinding dispatcher. For the focused window
 * it runs commands by ID for every keybinding after the overrides in
 * `App.settings.keybindings`, so that:
 * - second defaults (F5 for Run, F1 for the palette), commands without a menu
 *   item and scoped keybindings (Clear console in the console) work;
 * - Monaco never shadows an app command: this listens in the capture phase,
 *   so Monaco only gets the keys the app doesn't use.
 *
 * A key it handles is `preventDefault`ed, so the native menu doesn't run the
 * command again. The menu still covers keys pressed where the page has no
 * focus (DevTools, native dialogs).
 *
 * It also tells main what a context menu opens over (`Window.ReportContextMenu`).
 */
import { useEffect, useRef } from 'react';

import { windowApi } from '../../../ipc/renderer';
import {
  isCommandEnabled,
  type CommandId,
  type KeyContext,
} from '../../../shared/commands';
import {
  acceleratorFromKey,
  matchKeybinding,
  resolveKeybindings,
  type FocusContext,
} from '../../../shared/settings';
import type { AppState, WindowState } from '../../../shared/stores';
import { useAppState, useWindowState } from '../../state';

/** Undo, redo and select all keep their native keys: Monaco's, a text field's, or the Edit menu's. */
const NATIVE: ReadonlySet<CommandId> = new Set<CommandId>([
  'edit.undo',
  'edit.redo',
  'edit.selectAll',
]);

/** Where an element is: a Monaco editor, the console (its tour anchor), or elsewhere. */
export function focusContextOf(target: EventTarget | null): FocusContext {
  if (!(target instanceof Element)) return 'other';
  if (target.closest('.monaco-editor')) return 'editor';
  if (target.closest('[data-tour="console"]')) return 'console';
  return 'other';
}

type KeyEventLike = Pick<
  KeyboardEvent,
  | 'key'
  | 'code'
  | 'metaKey'
  | 'ctrlKey'
  | 'altKey'
  | 'shiftKey'
  | 'isComposing'
  | 'target'
>;

/** The command a key press runs in this window, or undefined when the app leaves the key alone. */
export function commandForKey(
  event: KeyEventLike,
  app: AppState,
  win: WindowState | undefined,
): CommandId | undefined {
  if (event.isComposing) return undefined;
  if (
    event.target instanceof Element &&
    event.target.closest('[data-keybinding-recorder]')
  )
    return undefined;
  const accelerator = acceleratorFromKey(event, app.platform);
  if (!accelerator) return undefined;
  const active = new Set<KeyContext>();
  const focus = focusContextOf(event.target);
  if (focus !== 'other') active.add(focus);
  if (win?.run?.status === 'running') active.add('running');
  const bindings = resolveKeybindings(app.platform, app.settings.keybindings);
  const binding = matchKeybinding(bindings, accelerator, active, app.platform);
  if (!binding || NATIVE.has(binding.id) || !isCommandEnabled(binding.id, app, win))
    return undefined;
  return binding.id;
}

export function useKeybindings(): void {
  const app = useAppState();
  const win = useWindowState();
  const state = useRef({ app, win });
  useEffect(() => {
    state.current = { app, win };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { app, win } = state.current;
      if (!app) return;
      const id = commandForKey(event, app, win ?? undefined);
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      windowApi
        .RunCommand(id)
        .catch((error: unknown) => console.error(`[fiddle] command ${id} failed`, error));
    };
    const onContextMenu = (event: MouseEvent) => {
      windowApi
        .ReportContextMenu(focusContextOf(event.target))
        .catch((error: unknown) =>
          console.error('[fiddle] reporting the context menu failed', error),
        );
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, []);
}
