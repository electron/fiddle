import { useEffect } from 'react';

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
import { useLatest } from '../../hooks';
import { toastError } from '../../toast-error';

/** Undo, redo and select all keep their native keys: Monaco's, a text field's, or the Edit menu's. */
const NATIVE: ReadonlySet<CommandId> = new Set<CommandId>([
  'edit.undo',
  'edit.redo',
  'edit.selectAll',
]);

/** Where an element is: a Monaco editor, the console (`data-region="console"`), or elsewhere. */
export function focusContextOf(target: EventTarget | null): FocusContext {
  if (!(target instanceof Element)) return 'other';
  if (target.closest('.monaco-editor')) return 'editor';
  if (target.closest('[data-region="console"]')) return 'console';
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

/** Capture phase, so Monaco only gets the keys the app doesn't use. A handled key is prevented so the native menu doesn't run it again. */
export function useKeybindings(): void {
  const app = useAppState();
  const win = useWindowState();
  const state = useLatest({ app, win });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { app, win } = state.current;
      if (!app) return;
      const id = commandForKey(event, app, win ?? undefined);
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      windowApi.RunCommand(id).catch(toastError);
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
  }, [state]);
}
