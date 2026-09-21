/** Tests the window's optimistic changes: what shows before main answers, what is sent, and what a refusal undoes. */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  versionsApi: { SetVersion: vi.fn() },
  documentsApi: {
    SetActiveFile: vi.fn(),
    SetFileVisible: vi.fn((_name: string, _visible: boolean) => Promise.resolve(2)),
    MoveFile: vi.fn((_name: string, _before: string | null) => Promise.resolve(2)),
    SetLayout: vi.fn((_layout: unknown) => Promise.resolve(2)),
    SetView: vi.fn((_view: string) => Promise.resolve(2)),
  },
  modulesApi: {
    AddModule: vi.fn((_name: string, _version: string | null) => Promise.resolve(2)),
  },
  showToast: vi.fn(),
}));

vi.mock('../../ipc/renderer', () => ({
  versionsApi: mocks.versionsApi,
  documentsApi: mocks.documentsApi,
  modulesApi: mocks.modulesApi,
}));
vi.mock('../../ui', () => ({ showToast: mocks.showToast }));

import { DEFAULT_LAYOUT, type WindowState } from '../../shared/stores';
import {
  addModule,
  moveFile,
  setActiveFile,
  setFileVisible,
  setLayout,
  setVersionRef,
  setView,
  useWithPending,
} from './window-state';

const base = {
  rev: 1,
  view: 'editor',
  layout: { panes: [] },
  fiddle: {
    versionRef: { kind: 'release', version: '44.0.0' },
    activeFile: 'main.js',
    files: [
      { name: 'main.js', visible: true },
      { name: 'view.js', visible: false },
    ],
  },
} as unknown as WindowState;

/** A split window on three visible files, main.js focused. */
const split = {
  rev: 1,
  view: 'editor',
  layout: { ...DEFAULT_LAYOUT, panes: ['main.js', 'renderer.js'] },
  fiddle: {
    activeFile: 'main.js',
    files: [
      { name: 'main.js', visible: true },
      { name: 'renderer.js', visible: true },
      { name: 'index.html', visible: true },
    ],
    modules: { electron: '30.0.0' },
  },
} as unknown as WindowState;

const seen: Array<WindowState | null> = [];
const shown = () => seen.at(-1) ?? null;
function Reader({ state }: { state: WindowState | null }) {
  seen.push(useWithPending(state));
  return null;
}
const fileNames = () => shown()?.fiddle.files.map((file) => file.name);

afterEach(() => {
  // The store catching up drops the changes main accepted, so none leak into the next test.
  render(<Reader state={{ ...base, rev: 1000 }} />);
  vi.clearAllMocks();
  seen.length = 0;
});

describe('window state changes', () => {
  it('shows a picked version before main has answered, and reverts it when main refuses', async () => {
    render(<Reader state={base} />);
    let reject!: (error: Error) => void;
    mocks.versionsApi.SetVersion.mockReturnValueOnce(
      new Promise((_resolve, fail) => (reject = fail)),
    );
    void act(
      () =>
        void setVersionRef(
          { kind: 'release', version: '43.0.0' },
          'Could not change the version',
        ),
    );
    await vi.waitFor(() =>
      expect(shown()?.fiddle.versionRef).toEqual({ kind: 'release', version: '43.0.0' }),
    );
    await act(async () => reject(new Error('offline')));
    expect(shown()?.fiddle.versionRef).toEqual({ kind: 'release', version: '44.0.0' });
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Could not change the version',
        description: 'offline',
      }),
    );
  });

  it('opens a hidden file and makes it active until the store catches up', async () => {
    const view = render(<Reader state={base} />);
    mocks.documentsApi.SetActiveFile.mockResolvedValueOnce(2);
    await act(() => setActiveFile('view.js', 'failed'));
    expect(shown()?.fiddle.activeFile).toBe('view.js');
    expect(shown()?.fiddle.files.find((file) => file.name === 'view.js')?.visible).toBe(
      true,
    );
    const next = structuredClone(base);
    next.rev = 2;
    next.fiddle.activeFile = 'view.js';
    view.rerender(<Reader state={next} />);
    expect(shown()).toBe(next);
  });

  it('is null until the store has loaded', () => {
    render(<Reader state={null} />);
    expect(shown()).toBeNull();
  });

  it('patches the layout at once and sends main the whole of it', async () => {
    render(<Reader state={split} />);
    await act(() => setLayout(split.layout, { consoleHeight: 300 }, 'failed'));
    expect(shown()?.layout).toEqual({ ...split.layout, consoleHeight: 300 });
    expect(mocks.documentsApi.SetLayout).toHaveBeenCalledWith({
      ...split.layout,
      consoleHeight: 300,
    });
  });

  it('hides a file at once, and its pane with it, like main will', async () => {
    render(<Reader state={split} />);
    await act(() => setFileVisible('renderer.js', false, 'failed'));
    expect(
      shown()?.fiddle.files.find((file) => file.name === 'renderer.js')?.visible,
    ).toBe(false);
    // One pane left is stored as no split.
    expect(shown()?.layout.panes).toEqual([]);
    expect(shown()?.fiddle.activeFile).toBe('main.js');
    expect(mocks.documentsApi.SetFileVisible).toHaveBeenCalledWith('renderer.js', false);
  });

  it('keeps the layout object when showing a file changes no pane', async () => {
    render(<Reader state={base} />);
    await act(() => setFileVisible('view.js', true, 'failed'));
    expect(shown()?.layout).toBe(base.layout);
    expect(shown()?.fiddle.files.every((file) => file.visible)).toBe(true);
  });

  it('moves a tab in front of another, or to the end, before main has answered', async () => {
    render(<Reader state={split} />);
    await act(() => moveFile('index.html', 'main.js', 'failed'));
    expect(fileNames()).toEqual(['index.html', 'main.js', 'renderer.js']);
    await act(() => moveFile('index.html', null, 'failed'));
    expect(fileNames()).toEqual(['main.js', 'renderer.js', 'index.html']);
    expect(mocks.documentsApi.MoveFile).toHaveBeenLastCalledWith('index.html', null);
  });

  it('switches to the Settings page at once', async () => {
    render(<Reader state={split} />);
    await act(() => setView('settings', 'failed'));
    expect(shown()?.view).toBe('settings');
    expect(mocks.documentsApi.SetView).toHaveBeenCalledWith('settings');
  });

  it('lists an added module at its version right away, but waits for main to resolve "latest"', async () => {
    render(<Reader state={split} />);
    await act(() => addModule('lodash', '4.17.21', 'failed'));
    expect(shown()?.fiddle.modules).toEqual({ electron: '30.0.0', lodash: '4.17.21' });
    await act(() => addModule('react', null, 'failed'));
    expect(shown()?.fiddle.modules).toEqual({ electron: '30.0.0', lodash: '4.17.21' });
    expect(mocks.modulesApi.AddModule).toHaveBeenLastCalledWith('react', null);
  });
});
