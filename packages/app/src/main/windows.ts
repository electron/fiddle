/** Which BrowserWindow belongs to which `windowId`, and the one main-to-window command channel. */
import { BrowserWindow, type BaseWindow } from 'electron';

import { Window } from '../ipc/main';
import type { WindowCommandId } from '../shared/commands';

const windows = new Map<string, BrowserWindow>();

export function trackWindow(windowId: string, win: BrowserWindow): void {
  windows.set(windowId, win);
}

export function untrackWindow(windowId: string): void {
  windows.delete(windowId);
}

export function getWindow(windowId: string | undefined): BrowserWindow | undefined {
  if (windowId === undefined) return undefined;
  const win = windows.get(windowId);
  return win && !win.isDestroyed() ? win : undefined;
}

export function windowIdOf(win: BaseWindow | null | undefined): string | undefined {
  if (!win) return undefined;
  for (const [windowId, candidate] of windows) if (candidate === win) return windowId;
  return undefined;
}

export function focusedWindowId(): string | undefined {
  return windowIdOf(BrowserWindow.getFocusedWindow());
}

/** Sends `Window.Command` to a window, for handlers that act on Monaco, view state or a dialog there. */
export function sendWindowCommand(windowId: string | undefined, id: WindowCommandId): void {
  const contents = getWindow(windowId)?.webContents;
  if (contents) Window.getDispatcher(contents)?.dispatchCommand(id);
}
