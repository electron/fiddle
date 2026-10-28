import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

import { windowApi } from '../ipc/renderer';
import { formatAccelerator } from '../shared/accelerators';
import type { CommandId } from '../shared/commands';
import { effectiveAccelerator } from '../shared/settings';
import { useAppState } from './state';

/** A ref holding `value` as of the latest render, for handlers that are registered once. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Calls `handler`, as of the latest render, for each command main forwards to this window (a menu item, a shortcut). */
export function useCommand(handler: (id: string) => void): void {
  const latest = useLatest(handler);
  useEffect(() => windowApi.onCommand((id) => latest.current(id)), [latest]);
}

/** A command's shortcut as a tooltip or menu hint writes it, after the user's overrides. Undefined when unbound. */
export function useShortcut(id: CommandId): string | undefined {
  const app = useAppState();
  if (!app) return undefined;
  return formatAccelerator(
    effectiveAccelerator(id, app.platform, app.settings.keybindings),
    app.platform,
  );
}
