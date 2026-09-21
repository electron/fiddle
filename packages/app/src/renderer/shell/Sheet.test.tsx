/** Tests the editor sheet: the tab row, split panes, tab drag-and-drop, the console splitter and the empty state. */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dir: 'ltr' as 'ltr' | 'rtl' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
    i18n: { dir: () => mocks.dir },
  }),
}));
// Monaco can't run in jsdom: each pane is a button that stands in for focusing its editor.
vi.mock('../editor/EditorPane', () => ({
  EditorPane: ({
    file,
    primary,
    onFocus,
  }: {
    file: string;
    primary: boolean;
    onFocus: () => void;
  }) => (
    <button type="button" data-editor={file} data-primary={primary} onClick={onFocus}>
      {`editor ${file}`}
    </button>
  ),
}));
vi.mock('../features/run/ConsolePane', () => ({
  ConsolePane: () => <div role="log">console</div>,
}));
vi.mock('../features/settings/SettingsPage', () => ({
  SettingsPage: () => <h1>settings page</h1>,
}));
vi.mock('../state', () => ({ useAppState: () => undefined }));

import { DEFAULT_LAYOUT, type WindowState } from '../../shared/stores';
import { setEditorMarkers } from '../editor/diagnostics';
import { Sheet } from './Sheet';
import { TAB_DRAG_TYPE } from './tab-drag';

/** The size every observed element reports: the sheet is 600px tall, the pane row 800px wide. */
const SIZE = { width: 800, height: 600 };
class ResizeObserverStub {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    this.callback(
      [{ target, contentRect: SIZE } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  disconnect(): void {}
}

/** What jsdom lacks of `DataTransfer`: typed data, with `types` lower-cased like the browser's. */
function dataTransfer() {
  const data = new Map<string, string>();
  return {
    dropEffect: 'none',
    effectAllowed: 'uninitialized',
    get types() {
      return [...data.keys()];
    },
    getData: (type: string) => data.get(type.toLowerCase()) ?? '',
    setData: (type: string, value: string) => void data.set(type.toLowerCase(), value),
  };
}
type DataTransferStub = ReturnType<typeof dataTransfer>;

/** jsdom has no `DragEvent`: a mouse event carrying `dataTransfer`, which is all React reads. */
function drag(
  type: 'dragstart' | 'dragenter' | 'dragover' | 'dragleave' | 'drop' | 'dragend',
  target: Element,
  transfer: DataTransferStub,
  init: MouseEventInit = {},
): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  fireEvent(target, event);
}

const file = (name: string, visible = true) => ({ name, visible });
function windowState(
  overrides: {
    files?: WindowState['fiddle']['files'];
    dirtyFiles?: string[];
    layout?: Partial<WindowState['layout']>;
    view?: WindowState['view'];
  } = {},
): WindowState {
  return {
    rev: 1,
    title: 'fiddle',
    view: overrides.view ?? 'editor',
    layout: { ...DEFAULT_LAYOUT, ...overrides.layout },
    fiddle: {
      name: 'fiddle',
      dirty: false,
      fiddleRev: 0,
      activeFile: 'main.js',
      files: overrides.files ?? [
        file('main.js'),
        file('renderer.js'),
        file('index.html'),
        file('gone.js', false),
      ],
      dirtyFiles: overrides.dirtyFiles ?? [],
    },
  } as unknown as WindowState;
}

type Props = ComponentProps<typeof Sheet>;
function handlers() {
  return {
    onSelectFile: vi.fn<Props['onSelectFile']>(),
    onCloseFile: vi.fn<Props['onCloseFile']>(),
    onMoveFile: vi.fn<Props['onMoveFile']>(),
    onDropOnPane: vi.fn<Props['onDropOnPane']>(),
    onFocusPane: vi.fn<Props['onFocusPane']>(),
    onToggleSplit: vi.fn<Props['onToggleSplit']>(),
    onClosePane: vi.fn<Props['onClosePane']>(),
    onMaximize: vi.fn<Props['onMaximize']>(),
    onConsoleHeight: vi.fn<Props['onConsoleHeight']>(),
    onHideConsole: vi.fn<Props['onHideConsole']>(),
    onResetLayout: vi.fn<Props['onResetLayout']>(),
  };
}

function setup(overrides: Partial<Props> = {}) {
  const on = handlers();
  const props: Props = {
    state: windowState(),
    active: 'main.js',
    panes: ['main.js'],
    dropping: false,
    ...on,
    ...overrides,
  };
  const view = render(<Sheet {...props} />);
  return { ...view, on, props };
}

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}`) });
const tabRow = () => screen.getByRole('tablist').parentElement!.parentElement!;
const pane = (index: number) =>
  document.querySelector<HTMLElement>(`[data-pane-index="${index}"]`)!;
const dropZone = (index: number, position: string) =>
  pane(index).querySelector(`[data-drop-zone="${position}"]`);

/** Starts dragging `name`'s tab, as the browser would: the tab sets the data, the window hears it start. */
function startDrag(name: string): DataTransferStub {
  const transfer = dataTransfer();
  drag('dragstart', tab(name), transfer);
  act(() => vi.advanceTimersByTime(1));
  return transfer;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  mocks.dir = 'ltr';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => setEditorMarkers([]));
});

describe('Sheet without an open file', () => {
  it('offers to reset the layout, with the console still below', () => {
    const { on } = setup({ active: null, panes: [] });
    screen.getByText('emptyTitle');
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'resetLayout' }));
    expect(on.onResetLayout).toHaveBeenCalledOnce();
    screen.getByRole('log');
  });

  it('leaves the console out when it is hidden', () => {
    setup({
      active: null,
      panes: [],
      state: windowState({ layout: { consoleVisible: false } }),
    });
    expect(screen.queryByRole('log')).toBeNull();
    expect(screen.queryByRole('separator', { name: 'resizeConsole' })).toBeNull();
  });
});

describe('Sheet tab row', () => {
  it('lists the visible files, selects the active one and reports a picked tab', () => {
    const { on } = setup();
    expect(screen.getAllByRole('tab').map((node) => node.textContent)).toEqual([
      'main.js',
      'renderer.js',
      'index.html',
    ]);
    expect(tab('main.js').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tab('index.html'));
    expect(on.onSelectFile).toHaveBeenCalledWith('index.html');
  });

  it('closes a file from its tab: the close glyph, a middle click, or Delete', () => {
    const { on } = setup();
    fireEvent.click(tab('renderer.js').querySelector('[data-tab-close]')!);
    expect(on.onCloseFile).toHaveBeenLastCalledWith('renderer.js');
    fireEvent(
      tab('index.html'),
      new MouseEvent('auxclick', { bubbles: true, button: 1 }),
    );
    expect(on.onCloseFile).toHaveBeenLastCalledWith('index.html');
    fireEvent.keyDown(tab('main.js'), { key: 'Delete' });
    expect(on.onCloseFile).toHaveBeenLastCalledWith('main.js');
    expect(on.onSelectFile).not.toHaveBeenCalled();
  });

  it('names the process of the open file, and marks unsaved files and files with problems', () => {
    setup({
      active: 'index.html',
      state: windowState({ dirtyFiles: ['renderer.js'] }),
    });
    screen.getByText('processRenderer');
    expect(tab('renderer.js').textContent).toContain('unsaved');
    expect(tab('main.js').textContent).not.toContain('unsaved');

    act(() =>
      setEditorMarkers([
        { file: 'main.js', severity: 'error' },
        { file: 'main.js', severity: 'warning' },
        { file: 'renderer.js', severity: 'warning' },
        { file: 'renderer.js', severity: 'warning' },
      ]),
    );
    // Errors win over warnings; a file with only warnings counts those.
    expect(tab('main.js').textContent).toContain('errorCount:1');
    expect(tab('renderer.js').textContent).toContain('warningCount:2');
    expect(tab('index.html').textContent).toBe('index.html');
  });

  it('splits the editor from the row button, which closes the split once there is one', () => {
    const { on, rerender, props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'splitEditor' }));
    expect(on.onToggleSplit).toHaveBeenCalledOnce();

    rerender(<Sheet {...props} panes={['main.js', 'renderer.js']} />);
    const close = screen.getByRole('button', { name: 'closeSplit' });
    expect(close.getAttribute('aria-pressed')).toBe('true');
    // Split, the panes' headers name the processes instead of the row.
    expect(screen.queryByText('processMain')?.closest('[data-pane-index]')).toBeTruthy();
    fireEvent.click(close);
    expect(on.onToggleSplit).toHaveBeenCalledTimes(2);
  });
});

describe('Sheet panes', () => {
  it('shows one editor per pane, the active file primary, and reports focus moving to another pane', () => {
    const { on } = setup({ panes: ['main.js', 'renderer.js'] });
    const editors = screen.getAllByRole('button', { name: /^editor / });
    expect(editors.map((node) => node.dataset.editor)).toEqual([
      'main.js',
      'renderer.js',
    ]);
    expect(editors.map((node) => node.dataset.primary)).toEqual(['true', 'false']);
    fireEvent.click(editors[1]!);
    expect(on.onFocusPane).toHaveBeenCalledWith('renderer.js');
  });

  it('gives each split pane a header that maximizes or closes it, and the other pane’s tab the split glyph', () => {
    const { on } = setup({ panes: ['main.js', 'renderer.js'] });
    const second = within(pane(1));
    expect(second.getByText('renderer.js')).toBeTruthy();
    expect(second.getByText('processRenderer')).toBeTruthy();
    fireEvent.click(second.getByRole('button', { name: 'maximize' }));
    expect(on.onMaximize).toHaveBeenCalledWith('renderer.js');
    fireEvent.click(within(pane(0)).getByRole('button', { name: 'closePane' }));
    expect(on.onClosePane).toHaveBeenCalledWith('main.js');
    // Only the file showing in the unfocused pane carries the glyph (the tab's own icon, before its label).
    expect(tab('renderer.js').querySelector(':scope > svg')).toBeTruthy();
    expect(tab('main.js').querySelector(':scope > svg')).toBeNull();
    expect(tab('index.html').querySelector(':scope > svg')).toBeNull();
  });

  it('shows a pane’s problem count in its header', () => {
    setup({ panes: ['main.js', 'renderer.js'] });
    act(() => setEditorMarkers([{ file: 'renderer.js', severity: 'error' }]));
    expect(within(pane(1)).getByText('errorCount:1')).toBeTruthy();
    expect(within(pane(0)).queryByText(/Count/)).toBeNull();
  });

  it('resizes neighbouring panes from the divider between them, and evens them out again on reset', () => {
    setup({ panes: ['main.js', 'renderer.js'] });
    const divider = screen.getByRole('separator', { name: 'resizePanes' });
    // 800px shared equally.
    expect(divider.getAttribute('aria-valuenow')).toBe('400');
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider.getAttribute('aria-valuenow')).toBe('408');
    expect(pane(0).style.width).toBe('408px');
    // The first pane can grow only until its neighbour is at the minimum.
    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider.getAttribute('aria-valuenow')).toBe(String(800 - 160));
    fireEvent.keyDown(divider, { key: 'Enter' });
    expect(divider.getAttribute('aria-valuenow')).toBe('400');
  });

  it('covers the editors with the Settings page without unmounting them', () => {
    setup({ state: windowState({ view: 'settings' }) });
    screen.getByRole('heading', { name: 'settings page' });
    const editor = screen.getByRole('button', { name: 'editor main.js' });
    expect(editor.closest('[data-covered]')).toBeTruthy();
  });
});

describe('Sheet console splitter', () => {
  it('resizes the console between its minimum and half the sheet, committing once the drag settles', () => {
    const { on } = setup();
    const splitter = screen.getByRole('separator', { name: 'resizeConsole' });
    expect(splitter.getAttribute('aria-valuenow')).toBe('160');
    expect(splitter.getAttribute('aria-valuemax')).toBe('300');
    // The console sits below the handle, so dragging up grows it.
    fireEvent.keyDown(splitter, { key: 'ArrowUp' });
    fireEvent.keyDown(splitter, { key: 'ArrowUp' });
    expect(splitter.getAttribute('aria-valuenow')).toBe('176');
    expect(on.onConsoleHeight).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(on.onConsoleHeight).toHaveBeenCalledOnce();
    expect(on.onConsoleHeight).toHaveBeenCalledWith(176);

    fireEvent.keyDown(splitter, { key: 'End' });
    expect(splitter.getAttribute('aria-valuenow')).toBe('300');
  });

  it('keeps the console at least 96px tall, and closes it when dragged below half that', () => {
    const { on } = setup({ state: windowState({ layout: { consoleHeight: 100 } }) });
    const splitter = screen.getByRole('separator', { name: 'resizeConsole' });
    fireEvent.keyDown(splitter, { key: 'ArrowDown' });
    expect(splitter.getAttribute('aria-valuenow')).toBe('96');
    expect(on.onHideConsole).not.toHaveBeenCalled();
    // Home jumps to 0: well below half the minimum.
    fireEvent.keyDown(splitter, { key: 'Home' });
    expect(on.onHideConsole).toHaveBeenCalledOnce();
  });

  it('restores the default height on reset', () => {
    const { on } = setup({ state: windowState({ layout: { consoleHeight: 240 } }) });
    const splitter = screen.getByRole('separator', { name: 'resizeConsole' });
    fireEvent.keyDown(splitter, { key: 'Enter' });
    expect(splitter.getAttribute('aria-valuenow')).toBe('160');
    act(() => vi.advanceTimersByTime(250));
    expect(on.onConsoleHeight).toHaveBeenCalledWith(160);
  });

  it('shows a stored height that no longer fits at half the sheet', () => {
    setup({ state: windowState({ layout: { consoleHeight: 900 } }) });
    expect(
      screen
        .getByRole('separator', { name: 'resizeConsole' })
        .getAttribute('aria-valuenow'),
    ).toBe('300');
  });
});

describe('Sheet tab drag along the row', () => {
  /** Puts `name`'s tab at `left`, 100px wide, so the pointer can be over either half. */
  const place = (name: string, left: number) => {
    tab(name).getBoundingClientRect = () =>
      ({ left, width: 100, right: left + 100 }) as DOMRect;
  };

  it('carries the file name and marks the row while the drag lasts', () => {
    setup();
    const transfer = startDrag('renderer.js');
    expect(transfer.getData(TAB_DRAG_TYPE)).toBe('renderer.js');
    expect(transfer.effectAllowed).toBe('move');
    expect(tabRow().hasAttribute('data-tab-dragging')).toBe(true);
    drag('dragend', tab('renderer.js'), transfer);
    expect(tabRow().hasAttribute('data-tab-dragging')).toBe(false);
  });

  it('drops a tab in front of the tab under the pointer’s near half, showing where it will land first', () => {
    const { on } = setup();
    place('main.js', 0);
    const transfer = startDrag('index.html');
    drag('dragover', tab('main.js'), transfer, { clientX: 20 });
    expect(transfer.dropEffect).toBe('move');
    expect(tab('main.js').getAttribute('data-drop-indicator')).toBe('before');
    drag('drop', tab('main.js'), transfer, { clientX: 20 });
    expect(on.onMoveFile).toHaveBeenCalledWith('index.html', 'main.js');
    expect(tab('main.js').hasAttribute('data-drop-indicator')).toBe(false);
  });

  it('drops a tab after the tab under the pointer’s far half, and at the end past the last tab', () => {
    const { on } = setup();
    place('renderer.js', 100);
    const transfer = startDrag('main.js');
    drag('dragover', tab('renderer.js'), transfer, { clientX: 180 });
    expect(tab('index.html').getAttribute('data-drop-indicator')).toBe('before');
    drag('drop', tab('renderer.js'), transfer, { clientX: 180 });
    expect(on.onMoveFile).toHaveBeenLastCalledWith('main.js', 'index.html');

    const again = startDrag('main.js');
    drag('dragover', tabRow(), again);
    expect(tab('index.html').getAttribute('data-drop-indicator')).toBe('after');
    drag('drop', tabRow(), again);
    expect(on.onMoveFile).toHaveBeenLastCalledWith('main.js', null);
  });

  it('shows nothing and moves nothing where the tab already is', () => {
    const { on } = setup();
    place('renderer.js', 100);
    place('index.html', 200);
    const transfer = startDrag('renderer.js');
    // Over its own near half, in front of the next tab, and (for the last tab) at the end: all where it is now.
    drag('dragover', tab('renderer.js'), transfer, { clientX: 110 });
    drag('dragover', tab('index.html'), transfer, { clientX: 210 });
    expect(document.querySelector('[data-drop-indicator]')).toBeNull();
    drag('drop', tab('index.html'), transfer, { clientX: 210 });
    const last = startDrag('index.html');
    drag('dragover', tabRow(), last);
    expect(document.querySelector('[data-drop-indicator]')).toBeNull();
    drag('drop', tabRow(), last);
    expect(on.onMoveFile).not.toHaveBeenCalled();
  });

  it('reads the near half from the other side in a right-to-left layout', () => {
    mocks.dir = 'rtl';
    const { on } = setup();
    place('main.js', 0);
    const transfer = startDrag('index.html');
    // The right half is the near one now.
    drag('drop', tab('main.js'), transfer, { clientX: 80 });
    expect(on.onMoveFile).toHaveBeenLastCalledWith('index.html', 'main.js');
  });

  it('clears the indicator when the drag leaves the row, and ignores drags that are not tabs', () => {
    const { on } = setup();
    place('main.js', 0);
    const transfer = startDrag('index.html');
    drag('dragover', tab('main.js'), transfer, { clientX: 20 });
    // Moving between the row's own children isn't leaving it.
    drag('dragleave', tabRow(), transfer, { relatedTarget: tab('renderer.js') });
    expect(tab('main.js').getAttribute('data-drop-indicator')).toBe('before');
    drag('dragleave', tabRow(), transfer, { relatedTarget: document.body });
    expect(tab('main.js').hasAttribute('data-drop-indicator')).toBe(false);

    const files = dataTransfer();
    files.setData('Files', '');
    drag('dragover', tab('main.js'), files, { clientX: 20 });
    expect(files.dropEffect).toBe('none');
    drag('drop', tab('main.js'), files, { clientX: 20 });
    expect(on.onMoveFile).not.toHaveBeenCalled();
  });

  it('ignores a drag start that carries no tab', () => {
    setup();
    const empty = dataTransfer();
    empty.setData(TAB_DRAG_TYPE, '');
    drag('dragstart', tabRow(), empty);
    drag('dragstart', tabRow(), dataTransfer());
    act(() => vi.advanceTimersByTime(1));
    expect(tabRow().hasAttribute('data-tab-dragging')).toBe(false);
  });
});

describe('Sheet tab drag onto panes', () => {
  it('offers another file a pane’s middle and both edges, and reports where it was dropped', () => {
    const { on } = setup({ panes: ['main.js', 'renderer.js'] });
    expect(dropZone(0, 'center')).toBeNull();
    const transfer = startDrag('index.html');
    for (const position of ['before', 'center', 'after'])
      expect(dropZone(0, position), position).toBeTruthy();

    const center = dropZone(1, 'center')!;
    drag('dragenter', center, transfer);
    expect(transfer.dropEffect).toBe('move');
    expect(center.parentElement?.getAttribute('data-over')).toBe('center');
    // Leaving for a sibling zone keeps the highlight; leaving the pane clears it.
    drag('dragleave', center.parentElement!, transfer, {
      relatedTarget: dropZone(1, 'after'),
    });
    expect(center.parentElement?.getAttribute('data-over')).toBe('center');
    drag('dragleave', center.parentElement!, transfer, { relatedTarget: document.body });
    expect(center.parentElement?.hasAttribute('data-over')).toBe(false);

    drag('dragover', dropZone(1, 'after')!, transfer);
    expect(center.parentElement?.getAttribute('data-over')).toBe('after');
    drag('drop', dropZone(1, 'after')!, transfer);
    expect(on.onDropOnPane).toHaveBeenCalledWith('index.html', 1, 'after');
  });

  it('offers a showing file only the drops that would change the panes', () => {
    setup({ panes: ['main.js', 'renderer.js'] });
    startDrag('main.js');
    // Its own pane takes nothing; "before" the second pane is where it already is.
    expect(pane(0).querySelector('[data-drop-zone]')).toBeNull();
    expect(
      [...pane(1).querySelectorAll<HTMLElement>('[data-drop-zone]')].map(
        (zone) => zone.dataset.dropZone,
      ),
    ).toEqual(['center', 'after']);
  });

  it('opens no fifth pane', () => {
    setup({
      state: windowState({
        files: ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'].map((name) => file(name)),
      }),
      active: 'a.js',
      panes: ['a.js', 'b.js', 'c.js', 'd.js'],
    });
    startDrag('e.js');
    for (let index = 0; index < 4; index += 1)
      expect(
        [...pane(index).querySelectorAll<HTMLElement>('[data-drop-zone]')].map(
          (zone) => zone.dataset.dropZone,
        ),
      ).toEqual(['center']);
  });

  it('ignores drops and drags over a zone that carry no tab', () => {
    const { on } = setup({ panes: ['main.js', 'renderer.js'] });
    startDrag('index.html');
    const center = dropZone(1, 'center')!;
    const files = dataTransfer();
    files.setData('Files', '');
    drag('dragenter', center, files);
    expect(center.parentElement?.hasAttribute('data-over')).toBe(false);
    drag('drop', center, files);
    expect(on.onDropOnPane).not.toHaveBeenCalled();
  });
});
