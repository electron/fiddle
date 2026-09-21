/** Tests the window shell: forwarded commands, and how tab, pane, sidebar and title bar requests become store changes. */
import { act, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Sidebar } from '../features/files/Sidebar';
import type { Sheet } from './Sheet';
import type { TitleBar } from './TitleBar';

type SheetProps = ComponentProps<typeof Sheet>;
type SidebarProps = ComponentProps<typeof Sidebar>;
type TitleBarProps = ComponentProps<typeof TitleBar>;
interface HandleProps {
  value: number;
  onChange: (value: number) => void;
  onReset?: () => void;
}

const mocks = vi.hoisted(() => ({
  app: { platform: 'linux' } as unknown,
  win: null as unknown,
  commands: [] as Array<(id: string) => void>,
  reveal: null as { file: string; line: number; column: number; seq: number } | null,
  setLayout: vi.fn((..._args: unknown[]) => Promise.resolve(true)),
  moveFile: vi.fn((..._args: unknown[]) => Promise.resolve(true)),
  setActiveFile: vi.fn((..._args: unknown[]) => Promise.resolve(true)),
  setFileVisible: vi.fn((..._args: unknown[]) => Promise.resolve(true)),
  setView: vi.fn((..._args: unknown[]) => Promise.resolve(true)),
  claimReveal: vi.fn(),
  formatFocusedEditor: vi.fn(() => Promise.resolve()),
  toggleMinimap: vi.fn(),
  toggleSoftWrap: vi.fn(),
  syncModels: vi.fn((..._args: unknown[]) => Promise.resolve()),
  log: { error: vi.fn() },
  // The latest props the shell gave its parts, which stand in for them here.
  sheet: undefined as SheetProps | undefined,
  sidebar: undefined as SidebarProps | undefined,
  titleBar: undefined as TitleBarProps | undefined,
  handle: undefined as HandleProps | undefined,
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
vi.mock('../../ui', () => ({
  SplitHandle: (props: HandleProps) => {
    mocks.handle = props;
    return null;
  },
}));
vi.mock('../editor/editor-state', () => ({
  formatFocusedEditor: mocks.formatFocusedEditor,
  toggleMinimap: mocks.toggleMinimap,
  toggleSoftWrap: mocks.toggleSoftWrap,
}));
vi.mock('../editor/models', () => ({
  applyRuntimeErrors: vi.fn(),
  markModelsSynced: vi.fn(),
  syncModels: mocks.syncModels,
}));
vi.mock('../editor/runtime-errors', () => ({
  claimReveal: mocks.claimReveal,
  setRuntimeErrors: vi.fn(),
  useRevealRequest: () => mocks.reveal,
}));
vi.mock('../editor/types', () => ({ useEditorTypes: () => undefined }));
vi.mock('../features/about/log', () => ({ log: mocks.log }));
vi.mock('../features/documents/useDocumentDrop', () => ({
  useDocumentDrop: () => false,
}));
vi.mock('../features/files/Sidebar', () => ({
  Sidebar: (props: SidebarProps) => {
    mocks.sidebar = props;
    return null;
  },
}));
vi.mock('./Sheet', () => ({
  Sheet: (props: SheetProps) => {
    mocks.sheet = props;
    return null;
  },
}));
vi.mock('./StatusBar', () => ({ StatusBar: () => null }));
vi.mock('./TitleBar', () => ({
  TitleBar: (props: TitleBarProps) => {
    mocks.titleBar = props;
    return null;
  },
}));
vi.mock('../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => mocks.win,
}));
vi.mock('./window-state', () => ({
  moveFile: mocks.moveFile,
  setActiveFile: mocks.setActiveFile,
  setFileVisible: mocks.setFileVisible,
  setLayout: mocks.setLayout,
  setView: mocks.setView,
}));

import { DEFAULT_LAYOUT, type WindowState } from '../../shared/stores';
import { Shell } from './Shell';

const file = (name: string, visible = true) => ({ name, visible });
const windowState = (
  layout: Partial<WindowState['layout']>,
  fiddle: Partial<WindowState['fiddle']> = {},
): WindowState =>
  ({
    rev: 1,
    title: 'fiddle',
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
      ...fiddle,
    },
  }) as unknown as WindowState;

/** What main's `Window.Command` push does: every listener registered with `windowApi.onCommand` hears it. */
const forward = (id: string) =>
  act(() => mocks.commands.forEach((listener) => listener(id)));
const sheet = () => mocks.sheet!;
const sidebar = () => mocks.sidebar!;
const titleBar = () => mocks.titleBar!;
/** The layout patches sent to main, in order. */
const layoutPatches = () => mocks.setLayout.mock.calls.map((call) => call[1]);
const activated = () => mocks.setActiveFile.mock.calls.map((call) => call[0]);
const visibilityChanges = () =>
  mocks.setFileVisible.mock.calls.map((call) => [call[0], call[1]]);

beforeEach(() => {
  mocks.commands.length = 0;
  mocks.reveal = null;
  mocks.win = windowState({ sidebar: true, consoleVisible: true });
});
afterEach(() => vi.clearAllMocks());

describe('Shell', () => {
  it('renders nothing until both stores have loaded', () => {
    mocks.win = null;
    mocks.sheet = undefined;
    const view = render(<Shell />);
    expect(view.container.firstChild).toBeNull();
    expect(mocks.sheet).toBeUndefined();
  });

  it('names the document after the window title and logs a failed model sync', async () => {
    mocks.syncModels.mockRejectedValueOnce(new Error('disposed'));
    const state = windowState({});
    state.title = 'main.js - My fiddle';
    mocks.win = state;
    render(<Shell />);
    expect(document.title).toBe('main.js - My fiddle');
    await vi.waitFor(() =>
      expect(mocks.log.error).toHaveBeenCalledWith(
        'syncing editor models failed',
        expect.any(Error),
      ),
    );
  });
});

describe('Shell tabs and panes', () => {
  it('shows the visible files as tabs, the active one selected, in one pane until the layout splits', () => {
    mocks.win = windowState(
      {},
      { files: [file('a.js'), file('b.js', false), file('c.js')] },
    );
    const view = render(<Shell />);
    expect(sheet().active).toBe('a.js');
    expect(sheet().panes).toEqual(['a.js']);
    // A stale active file that isn't visible falls back to the first tab.
    mocks.win = windowState(
      { panes: ['c.js', 'a.js'] },
      { activeFile: 'b.js', files: [file('a.js'), file('b.js', false), file('c.js')] },
    );
    view.rerender(<Shell />);
    expect(sheet().active).toBe('a.js');
    expect(sheet().panes).toEqual(['c.js', 'a.js']);
  });

  it('splits the editor beside renderer.js (or the next file), showing it first if it was hidden, and unsplits to the focused pane', () => {
    mocks.win = windowState(
      {},
      {
        activeFile: 'main.js',
        files: [file('main.js'), file('renderer.js', false), file('index.html')],
      },
    );
    const view = render(<Shell />);
    act(() => sheet().onToggleSplit());
    expect(visibilityChanges()).toEqual([['renderer.js', true]]);
    expect(layoutPatches()).toEqual([{ panes: ['main.js', 'renderer.js'] }]);
    expect(activated()).toEqual([]);

    mocks.win = windowState(
      { panes: ['main.js', 'renderer.js'] },
      {
        activeFile: 'renderer.js',
        files: [file('main.js'), file('renderer.js'), file('index.html')],
      },
    );
    view.rerender(<Shell />);
    forward('view.toggleSplit');
    // One pane is stored as "not split".
    expect(layoutPatches().at(-1)).toEqual({ panes: [] });
  });

  it('cannot split a fiddle of one file', () => {
    mocks.win = windowState({}, { activeFile: 'a.js', files: [file('a.js')] });
    render(<Shell />);
    act(() => sheet().onToggleSplit());
    expect(mocks.setLayout).not.toHaveBeenCalled();
  });

  it('closes a tab by hiding its file, moving to the next tab (or the previous) when it was the active one', () => {
    mocks.win = windowState({}, { activeFile: 'b.js' });
    const view = render(<Shell />);
    act(() => sheet().onCloseFile('a.js'));
    expect(activated()).toEqual([]);
    expect(visibilityChanges()).toEqual([['a.js', false]]);

    act(() => sheet().onCloseFile('b.js'));
    expect(activated()).toEqual(['c.js']);
    mocks.win = windowState(
      {},
      { activeFile: 'c.js', files: [file('a.js'), file('c.js')] },
    );
    view.rerender(<Shell />);
    act(() => sheet().onCloseFile('c.js'));
    expect(activated()).toEqual(['c.js', 'a.js']);
    expect(visibilityChanges()).toEqual([
      ['a.js', false],
      ['b.js', false],
      ['c.js', false],
    ]);
  });

  it('closes a split pane with its tab, focusing the neighbouring pane when it had focus', () => {
    mocks.win = windowState({ panes: ['a.js', 'b.js', 'c.js'] }, { activeFile: 'b.js' });
    render(<Shell />);
    act(() => sheet().onCloseFile('b.js'));
    expect(layoutPatches()).toEqual([{ panes: ['a.js', 'c.js'] }]);
    expect(activated()).toEqual(['c.js']);
    expect(visibilityChanges()).toEqual([['b.js', false]]);
    // A pane without focus just goes.
    act(() => sheet().onCloseFile('a.js'));
    expect(layoutPatches().at(-1)).toEqual({ panes: ['b.js', 'c.js'] });
    expect(activated()).toEqual(['c.js']);
  });

  it('closes or maximizes a pane from its header without hiding any file', () => {
    mocks.win = windowState({ panes: ['a.js', 'b.js'] }, { activeFile: 'a.js' });
    render(<Shell />);
    act(() => sheet().onClosePane('a.js'));
    expect(layoutPatches()).toEqual([{ panes: [] }]);
    expect(activated()).toEqual(['b.js']);
    act(() => sheet().onClosePane('b.js'));
    expect(activated()).toEqual(['b.js']);
    act(() => sheet().onMaximize('b.js'));
    expect(layoutPatches()).toHaveLength(3);
    expect(activated()).toEqual(['b.js', 'b.js']);
    expect(mocks.setFileVisible).not.toHaveBeenCalled();
  });

  it('opens a dropped tab in a new pane on that side, or in the pane itself, and focuses it', () => {
    mocks.win = windowState({}, { activeFile: 'a.js' });
    const view = render(<Shell />);
    act(() => sheet().onDropOnPane('c.js', 0, 'before'));
    expect(layoutPatches()).toEqual([{ panes: ['c.js', 'a.js'] }]);
    expect(activated()).toEqual(['c.js']);

    mocks.win = windowState({ panes: ['c.js', 'a.js'] }, { activeFile: 'c.js' });
    view.rerender(<Shell />);
    act(() => sheet().onDropOnPane('b.js', 1, 'center'));
    expect(layoutPatches().at(-1)).toEqual({ panes: ['c.js', 'b.js'] });
    expect(activated().at(-1)).toBe('b.js');
  });

  it('ignores a drop of a file that is no longer visible, or that would open a fifth pane', () => {
    const files = ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'].map((name) => file(name));
    mocks.win = windowState(
      { panes: ['a.js', 'b.js', 'c.js', 'd.js'] },
      { activeFile: 'a.js', files: [...files, file('gone.js', false)] },
    );
    render(<Shell />);
    act(() => sheet().onDropOnPane('gone.js', 0, 'center'));
    act(() => sheet().onDropOnPane('e.js', 3, 'after'));
    expect(mocks.setLayout).not.toHaveBeenCalled();
    expect(mocks.setActiveFile).not.toHaveBeenCalled();
    act(() => sheet().onDropOnPane('e.js', 3, 'center'));
    expect(layoutPatches()).toEqual([{ panes: ['a.js', 'b.js', 'c.js', 'e.js'] }]);
  });

  it('activates a file picked from a tab, another pane or a moved tab, but not the one that already is', () => {
    render(<Shell />);
    act(() => sheet().onSelectFile('b.js'));
    act(() => sheet().onFocusPane('a.js'));
    act(() => sheet().onFocusPane('c.js'));
    expect(activated()).toEqual(['b.js', 'c.js']);
    act(() => sheet().onMoveFile('c.js', 'a.js'));
    expect(mocks.moveFile).toHaveBeenCalledWith('c.js', 'a.js', 'fileChangeFailed');
  });
});

describe('Shell layout', () => {
  it('resets the layout to the defaults and shows every hidden file again', () => {
    mocks.win = windowState(
      { sidebar: false, panes: ['a.js', 'c.js'] },
      { files: [file('a.js'), file('b.js', false), file('c.js')] },
    );
    render(<Shell />);
    act(() => sheet().onResetLayout());
    expect(layoutPatches()).toEqual([DEFAULT_LAYOUT]);
    expect(visibilityChanges()).toEqual([['b.js', true]]);
  });

  it('keeps a dragged sidebar width local until the drag settles, within its limits', () => {
    vi.useFakeTimers();
    try {
      mocks.win = windowState({ sidebarWidth: 999 });
      render(<Shell />);
      expect(mocks.handle?.value).toBe(320);
      act(() => mocks.handle?.onChange(250));
      act(() => mocks.handle?.onChange(240));
      expect(mocks.handle?.value).toBe(240);
      expect(mocks.setLayout).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(250));
      expect(layoutPatches()).toEqual([{ sidebarWidth: 240 }]);
      act(() => mocks.handle?.onReset?.());
      expect(mocks.handle?.value).toBe(DEFAULT_LAYOUT.sidebarWidth);
    } finally {
      vi.useRealTimers();
    }
  });

  it('has no sidebar, nor its splitter, while the layout hides it', () => {
    mocks.win = windowState({ sidebar: false });
    mocks.sidebar = undefined;
    mocks.handle = undefined;
    render(<Shell />);
    expect(mocks.sidebar).toBeUndefined();
    expect(mocks.handle).toBeUndefined();
    expect(titleBar().sidebar).toBe(false);
  });

  it('toggles the sidebar and the Settings page from the title bar', () => {
    const view = render(<Shell />);
    act(() => titleBar().onToggleSidebar());
    expect(layoutPatches()).toEqual([{ sidebar: false }]);
    act(() => titleBar().onToggleSettings());
    expect(mocks.setView).toHaveBeenLastCalledWith('settings', 'fileChangeFailed');

    const settings = windowState({});
    settings.view = 'settings';
    mocks.win = settings;
    view.rerender(<Shell />);
    expect(titleBar().settingsOpen).toBe(true);
    act(() => titleBar().onToggleSettings());
    expect(mocks.setView).toHaveBeenLastCalledWith('editor', 'fileChangeFailed');
  });
});

describe('Shell sidebar', () => {
  it('opens a picked file, leaving the Settings page for it', () => {
    const view = render(<Shell />);
    act(() => sidebar().onOpen('b.js'));
    expect(mocks.setView).not.toHaveBeenCalled();
    expect(activated()).toEqual(['b.js']);

    const settings = windowState({});
    settings.view = 'settings';
    mocks.win = settings;
    view.rerender(<Shell />);
    // No row is current under the Settings page, so even the active file can be picked.
    expect(sidebar().activeFile).toBeNull();
    act(() => sidebar().onOpen('a.js'));
    expect(mocks.setView).toHaveBeenCalledWith('editor', 'fileChangeFailed');
    expect(activated()).toEqual(['b.js', 'a.js']);
  });

  it('shows a file again, and hides one the way closing its tab does', () => {
    mocks.win = windowState({}, { activeFile: 'a.js' });
    render(<Shell />);
    act(() => sidebar().onSetVisible('b.js', true));
    expect(visibilityChanges()).toEqual([['b.js', true]]);
    act(() => sidebar().onSetVisible('a.js', false));
    expect(activated()).toEqual(['b.js']);
    expect(visibilityChanges()).toEqual([
      ['b.js', true],
      ['a.js', false],
    ]);
  });
});

describe('Shell reveal requests', () => {
  const revealOf = (name: string, seq: number) => ({
    file: name,
    line: 3,
    column: 1,
    seq,
  });

  it('opens the file a console link points at, leaving the Settings page, once per request', () => {
    const settings = windowState({});
    settings.view = 'settings';
    mocks.win = settings;
    mocks.reveal = revealOf('c.js', 1);
    const view = render(<Shell />);
    expect(mocks.setView).toHaveBeenCalledWith('editor', 'fileChangeFailed');
    expect(activated()).toEqual(['c.js']);
    view.rerender(<Shell />);
    expect(activated()).toEqual(['c.js']);
    expect(mocks.setView).toHaveBeenCalledOnce();

    // The active file needs no opening, only its pane.
    mocks.reveal = revealOf('a.js', 2);
    view.rerender(<Shell />);
    expect(activated()).toEqual(['c.js']);
    expect(mocks.claimReveal).not.toHaveBeenCalled();
  });

  it('claims a request for a file the fiddle no longer has, so no editor waits for it', () => {
    mocks.reveal = revealOf('gone.js', 5);
    render(<Shell />);
    expect(mocks.claimReveal).toHaveBeenCalledWith(5);
    expect(mocks.setActiveFile).not.toHaveBeenCalled();
  });
});
