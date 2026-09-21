/** The window registry: which BrowserWindow answers to which ID, and the command channel to it. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  focused: null as unknown,
  dispatchCommand: vi.fn(),
  getDispatcher: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => mocks.focused },
}));
vi.mock('../ipc/main', () => ({ Window: { getDispatcher: mocks.getDispatcher } }));

import {
  focusedWindowId,
  getWindow,
  sendWindowCommand,
  trackWindow,
  untrackWindow,
  windowIdOf,
} from './windows';

function fakeWindow() {
  return {
    destroyed: false,
    isDestroyed() {
      return this.destroyed;
    },
    webContents: {},
  };
}

beforeEach(() => {
  mocks.getDispatcher
    .mockReset()
    .mockReturnValue({ dispatchCommand: mocks.dispatchCommand });
  mocks.dispatchCommand.mockReset();
  mocks.focused = null;
});

describe('window registry', () => {
  it('finds a tracked window by ID until it is destroyed or untracked, and its ID by window', () => {
    const win = fakeWindow();
    trackWindow('a', win as never);
    expect(getWindow('a')).toBe(win);
    expect(getWindow(undefined)).toBeUndefined();
    expect(windowIdOf(win as never)).toBe('a');
    expect(windowIdOf(fakeWindow() as never)).toBeUndefined();
    expect(windowIdOf(null)).toBeUndefined();

    mocks.focused = win;
    expect(focusedWindowId()).toBe('a');

    win.destroyed = true;
    expect(getWindow('a')).toBeUndefined();
    untrackWindow('a');
    expect(windowIdOf(win as never)).toBeUndefined();
    expect(focusedWindowId()).toBeUndefined();
  });

  it('sends a window command to an open window only', () => {
    const win = fakeWindow();
    trackWindow('b', win as never);
    sendWindowCommand('b', 'editor.format');
    expect(mocks.getDispatcher).toHaveBeenCalledWith(win.webContents);
    expect(mocks.dispatchCommand).toHaveBeenCalledWith('editor.format');

    sendWindowCommand('nope', 'editor.format');
    sendWindowCommand(undefined, 'editor.format');
    win.destroyed = true;
    sendWindowCommand('b', 'editor.format');
    expect(mocks.dispatchCommand).toHaveBeenCalledOnce();
    untrackWindow('b');
  });
});
