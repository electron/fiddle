/** Which BrowserWindow belongs to which `windowId`. */
import { BrowserWindow, type BaseWindow } from 'electron';

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
