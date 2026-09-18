import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  app: { platform: 'linux' } as unknown,
  win: null as unknown,
  commands: [] as Array<(id: string) => void>,
  setLayout: vi.fn(() => Promise.resolve(true)),
  moveFile: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../ipc/renderer', () => ({
  windowApi: {
    onCommand: (listener: (id: string) => void) => {
      mocks.commands.push(listener);
      return () => undefined;
    },
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../ui', () => ({ SplitHandle: () => null }));
vi.mock('../editor/editor-state', () => ({
  formatFocusedEditor: vi.fn(),
  toggleMinimap: vi.fn(),
  toggleSoftWrap: vi.fn(),
}));
vi.mock('../editor/models', () => ({
  applyRuntimeErrors: vi.fn(),
  markModelsSynced: vi.fn(),
  syncModels: () => Promise.resolve(),
}));
vi.mock('../editor/runtime-errors', () => ({
  claimReveal: vi.fn(),
  useRevealRequest: () => null,
  useRuntimeErrors: () => [],
}));
vi.mock('../editor/types', () => ({ useEditorTypes: () => undefined }));
vi.mock('../features/documents/useDocumentDrop', () => ({
  useDocumentDrop: () => false,
}));
vi.mock('../features/files/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./Sheet', () => ({ Sheet: () => null }));
vi.mock('./StatusBar', () => ({ StatusBar: () => null }));
vi.mock('./TitleBar', () => ({ TitleBar: () => null }));
vi.mock('../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => mocks.win,
}));
vi.mock('./window-state', () => ({
  moveFile: mocks.moveFile,
  setActiveFile: vi.fn(),
  setFileVisible: vi.fn(),
  setLayout: mocks.setLayout,
  setView: vi.fn(),
}));

import { DEFAULT_LAYOUT, type WindowState } from '../../shared/stores';
import { Shell } from './Shell';

const file = (name: string) => ({ name, visible: true });
const windowState = (layout: Partial<WindowState['layout']>): WindowState =>
  ({
    rev: 1,
    view: 'editor',
    menuBar: null,
    layout: { ...DEFAULT_LAYOUT, ...layout },
    fiddle: {
      name: 'fiddle',
      dirty: false,
      fiddleRev: 0,
      activeFile: 'a.js',
      files: [file('a.js'), file('b.js'), file('c.js')],
      dirtyFiles: [],
    },
  }) as unknown as WindowState;

/** What main's `Window.Command` push does: every listener registered with `windowApi.onCommand` hears it. */
const forward = (id: string) =>
  act(() => mocks.commands.forEach((listener) => listener(id)));

beforeEach(() => {
  mocks.commands.length = 0;
  mocks.win = windowState({ sidebar: true, consoleVisible: true });
});
afterEach(() => vi.clearAllMocks());

describe('Shell', () => {
  // A forwarded command reads the layout as of the last render, not the first: toggling twice must undo itself.
  it('toggles the sidebar and the console from forwarded commands, from the current layout', () => {
    const view = render(<Shell />);
    forward('view.toggleSidebar');
    expect(mocks.setLayout).toHaveBeenLastCalledWith(
      expect.anything(),
      { sidebar: false },
      expect.anything(),
    );

    mocks.win = windowState({ sidebar: false, consoleVisible: true });
    view.rerender(<Shell />);
    forward('view.toggleSidebar');
    expect(mocks.setLayout).toHaveBeenLastCalledWith(
      expect.anything(),
      { sidebar: true },
      expect.anything(),
    );

    forward('view.toggleConsole');
    expect(mocks.setLayout).toHaveBeenLastCalledWith(
      expect.anything(),
      { consoleVisible: false },
      expect.anything(),
    );
    mocks.win = windowState({ sidebar: false, consoleVisible: false });
    view.rerender(<Shell />);
    forward('view.toggleConsole');
    expect(mocks.setLayout).toHaveBeenLastCalledWith(
      expect.anything(),
      { consoleVisible: true },
      expect.anything(),
    );
  });

  it('moves the active tab one place along the row, from the current active file', () => {
    const view = render(<Shell />);
    forward('editor.moveTabRight');
    expect(mocks.moveFile).toHaveBeenLastCalledWith('a.js', 'c.js', expect.anything());

    const next = windowState({});
    next.fiddle.activeFile = 'b.js';
    mocks.win = next;
    view.rerender(<Shell />);
    forward('editor.moveTabLeft');
    expect(mocks.moveFile).toHaveBeenLastCalledWith('b.js', 'a.js', expect.anything());
  });
});
