/** The Run IPC handlers: the bisect compare prompt, and the cleanup when a window's contents go away. */
import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => unknown>,
  openExternal: vi.fn<(url: string) => Promise<void>>(),
  messageBox:
    vi.fn<
      (
        windowId: string,
        options: { detail: string; buttons: string[] },
      ) => Promise<{ response: number }>
    >(),
  bindVersionsIpc: vi.fn(),
}));

vi.mock('electron', () => ({ shell: { openExternal: mocks.openExternal } }));
vi.mock('../../ipc/main', () => ({
  Run: {},
  implement: (_iface: unknown, _contents: unknown, handlers: typeof mocks.handlers) => {
    mocks.handlers = handlers;
  },
}));
vi.mock('../dialogs', () => ({ messageBox: mocks.messageBox }));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../versions/ipc', () => ({ bindVersionsIpc: mocks.bindVersionsIpc }));

import { bindRunIpc } from './ipc';

const COMPARE = 'https://github.com/electron/electron/compare/v30.0.0...v30.0.1';

const bisect = {
  compareUrl: vi.fn<(windowId: string) => string | undefined>(),
  stop: vi.fn(),
  mark: vi.fn(),
  start: vi.fn(),
};
const runs = { disposeWindow: vi.fn(), output: vi.fn(), clear: vi.fn() };
let contents: EventEmitter;

beforeEach(() => {
  vi.clearAllMocks();
  contents = new EventEmitter();
  bindRunIpc({ contents, windowId: 'w', services: { runs, bisect } } as never);
});

it('binds the Versions handlers for the same window', () => {
  expect(mocks.bindVersionsIpc).toHaveBeenCalledWith(
    expect.objectContaining({ contents, windowId: 'w' }),
  );
});

describe('OpenBisectCompare', () => {
  it('does nothing while the bisect has no range to compare', async () => {
    bisect.compareUrl.mockReturnValue(undefined);
    await mocks.handlers.OpenBisectCompare!();
    expect(mocks.messageBox).not.toHaveBeenCalled();
    expect(mocks.openExternal).not.toHaveBeenCalled();
  });

  it('shows the URL and opens it only when the first button is chosen', async () => {
    bisect.compareUrl.mockReturnValue(COMPARE);
    mocks.messageBox.mockResolvedValue({ response: 1 });
    await mocks.handlers.OpenBisectCompare!();
    expect(mocks.messageBox).toHaveBeenCalledWith(
      'w',
      expect.objectContaining({
        detail: COMPARE,
        buttons: ['openCompareButton', 'cancel'],
      }),
    );
    expect(mocks.openExternal).not.toHaveBeenCalled();

    mocks.messageBox.mockResolvedValue({ response: 0 });
    await mocks.handlers.OpenBisectCompare!();
    expect(mocks.openExternal).toHaveBeenCalledWith(COMPARE);
  });
});

it('scopes output, bisect and marking calls to its own window', () => {
  mocks.handlers.GetOutput!();
  mocks.handlers.ClearOutput!();
  mocks.handlers.StartBisect!('30.0.0', '31.0.0', true);
  mocks.handlers.BisectGood!();
  mocks.handlers.BisectBad!();
  mocks.handlers.BisectSkip!();
  mocks.handlers.StopBisect!();
  expect(runs.output).toHaveBeenCalledWith('w');
  expect(runs.clear).toHaveBeenCalledWith('w');
  expect(bisect.start).toHaveBeenCalledWith('w', '30.0.0', '31.0.0', true);
  expect(bisect.mark.mock.calls).toEqual([
    ['w', 'good'],
    ['w', 'bad'],
    ['w', 'skip'],
  ]);
  expect(bisect.stop).toHaveBeenCalledWith('w');
});

it("stops the bisect and disposes the window's runs when its contents are destroyed, once", () => {
  contents.emit('destroyed');
  contents.emit('destroyed');
  expect(bisect.stop).toHaveBeenCalledOnce();
  expect(bisect.stop).toHaveBeenCalledWith('w');
  expect(runs.disposeWindow).toHaveBeenCalledOnce();
  expect(runs.disposeWindow).toHaveBeenCalledWith('w');
});
