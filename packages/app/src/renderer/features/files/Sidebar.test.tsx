import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  documentsApi: {
    AddFile: vi.fn(() => Promise.resolve()),
    RenameFile: vi.fn((_from: string, _to: string) => Promise.resolve()),
    RemoveFile: vi.fn((_name: string) => Promise.resolve()),
  },
  toastError: vi.fn(),
  onSetVisible: vi.fn((_name: string, _visible: boolean) => undefined),
}));

vi.mock('../../../ipc/renderer', () => ({ documentsApi: mocks.documentsApi }));
vi.mock('../../toast-error', () => ({ toastError: mocks.toastError }));
vi.mock('../packages/PackagesSection', () => ({ PackagesSection: () => null }));

import { DialogHost } from '../../../ui';
import { Sidebar } from './Sidebar';

const TEMPLATE = ['main.js', 'preload.js', 'renderer.js', 'index.html'];

// Without an i18next instance, `t` returns the key, so names below are keys.
function renderSidebar(names: readonly string[] = TEMPLATE) {
  const onOpen = vi.fn();
  render(
    <>
      <Sidebar
        files={names.map((name) => ({ name, visible: true }))}
        dirtyFiles={[]}
        activeFile="main.js"
        onOpen={onOpen}
        onSetVisible={mocks.onSetVisible}
      />
      <DialogHost />
    </>,
  );
  return onOpen;
}

const list = () => screen.getByRole('treegrid', { name: 'files' });
const nameField = async () =>
  (await screen.findByRole('textbox', { name: 'fileName' })) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Sidebar list', () => {
  it('lists every file in one flat list, in fiddle order', () => {
    renderSidebar([...TEMPLATE, 'main-menu.js', 'styles.css', 'data.json']);
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'files',
    ]);
    expect(
      within(list())
        .getAllByRole('row')
        .map((row) => row.dataset.key),
    ).toEqual([...TEMPLATE, 'main-menu.js', 'styles.css', 'data.json']);
  });
});

describe('Sidebar context menu', () => {
  it('opens for the row under the pointer and acts on its file', async () => {
    renderSidebar();
    fireEvent.contextMenu(within(list()).getByRole('row', { name: /index\.html/ }), {
      clientX: 40,
      clientY: 60,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'rename' }));
    expect((await nameField()).value).toBe('index.html');
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves to another row on a right-click while open, and closes on one elsewhere', async () => {
    renderSidebar();
    const index = within(list()).getByRole('row', { name: /index\.html/ });
    const preload = within(list()).getByRole('row', { name: /preload\.js/ });
    // jsdom has no layout. The last row is scrolled out of the sidebar, its box over the rest of the window.
    screen.getByRole('navigation').getBoundingClientRect = () =>
      new DOMRect(0, 0, 200, 80);
    preload.getBoundingClientRect = () => new DOMRect(0, 20, 200, 20);
    index.getBoundingClientRect = () => new DOMRect(0, 290, 200, 20);
    // The open menu makes the rows inert, so a right-click on one lands on the body. False: no native menu.
    const rightClickAt = (y: number) =>
      fireEvent.contextMenu(document.body, { clientX: 40, clientY: y });

    fireEvent.contextMenu(index, { clientX: 40, clientY: 60 });
    await screen.findByRole('menu');
    expect(rightClickAt(30)).toBe(false);
    expect(fireEvent.contextMenu(await screen.findByRole('menu'))).toBe(false);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'rename' }));
    expect((await nameField()).value).toBe('preload.js');
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.contextMenu(preload, { clientX: 40, clientY: 30 });
    await screen.findByRole('menu');
    expect(rightClickAt(300)).toBe(false);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(rightClickAt(300)).toBe(true);
  });
});

describe('Sidebar context menu actions', () => {
  const openMenuOn = async (file: RegExp, item: string) => {
    fireEvent.contextMenu(screen.getByRole('row', { name: file }), {
      clientX: 40,
      clientY: 60,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: item }));
  };

  it('renames a file to the trimmed new name, and says why when main refuses', async () => {
    renderSidebar();
    await openMenuOn(/index\.html/, 'rename');
    fireEvent.change(await nameField(), { target: { value: ' page.html ' } });
    fireEvent.click(screen.getByRole('button', { name: 'renameConfirm' }));
    await waitFor(() =>
      expect(mocks.documentsApi.RenameFile).toHaveBeenCalledWith(
        'index.html',
        'page.html',
      ),
    );

    // The same name again changes nothing.
    await openMenuOn(/index\.html/, 'rename');
    await nameField();
    fireEvent.click(screen.getByRole('button', { name: 'renameConfirm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.documentsApi.RenameFile).toHaveBeenCalledTimes(1);

    const refusal = new Error('taken');
    mocks.documentsApi.RenameFile.mockRejectedValueOnce(refusal);
    await openMenuOn(/preload\.js/, 'rename');
    fireEvent.change(await nameField(), { target: { value: 'main.js' } });
    fireEvent.click(screen.getByRole('button', { name: 'renameConfirm' }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(refusal, 'fileChangeFailed'),
    );
  });

  it('deletes a file once confirmed, but never the main entry', async () => {
    renderSidebar();
    fireEvent.contextMenu(screen.getByRole('row', { name: /main\.js/ }), {
      clientX: 40,
      clientY: 60,
    });
    expect(
      (await screen.findByRole('menuitem', { name: 'delete' })).getAttribute(
        'aria-disabled',
      ),
    ).toBe('true');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    await openMenuOn(/renderer\.js/, 'delete');
    fireEvent.click(await screen.findByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(mocks.documentsApi.RemoveFile).not.toHaveBeenCalled();

    await openMenuOn(/renderer\.js/, 'delete');
    fireEvent.click(await screen.findByRole('button', { name: 'deleteConfirm' }));
    await waitFor(() =>
      expect(mocks.documentsApi.RemoveFile).toHaveBeenCalledWith('renderer.js'),
    );
  });
});

describe('Sidebar filter', () => {
  const MANY = [...TEMPLATE, 'a.js', 'b.js', 'c.js', 'd.js', 'e.js'];
  const sidebar = (names: readonly string[]) => (
    <Sidebar
      files={names.map((name) => ({ name, visible: true }))}
      dirtyFiles={[]}
      activeFile="main.js"
      onOpen={vi.fn()}
      onSetVisible={vi.fn()}
    />
  );

  it('filters only while its field is there', () => {
    const { rerender } = render(sidebar(MANY));
    fireEvent.change(screen.getByRole('textbox', { name: 'filterFiles' }), {
      target: { value: 'c.js' },
    });
    expect(screen.queryByRole('row', { name: /renderer\.js/ })).toBeNull();
    expect(screen.getByRole('row', { name: /c\.js/ })).toBeTruthy();

    // A smaller fiddle has no filter field, so nothing may stay hidden by the old text.
    rerender(sidebar(TEMPLATE));
    expect(screen.queryByRole('textbox', { name: 'filterFiles' })).toBeNull();
    expect(screen.getByRole('row', { name: /renderer\.js/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /main\.js/ })).toBeTruthy();
  });
});

describe('Sidebar add file', () => {
  it('adds the trimmed name and opens it', async () => {
    const onOpen = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'addFile' }));
    const input = await nameField();
    expect(input.value).toBe('');
    expect(screen.getByText('fileNameHint')).toBeTruthy();
    fireEvent.change(input, { target: { value: ' about.html ' } });
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    await waitFor(() =>
      expect(mocks.documentsApi.AddFile).toHaveBeenCalledWith('about.html'),
    );
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('about.html'));
  });

  it('adds nothing when cancelled', async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'addFile' }));
    await nameField();
    // The prompt outlives the component (one DialogHost per window), so close it.
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.documentsApi.AddFile).not.toHaveBeenCalled();
  });

  it("shows main's words when it refuses the name, and doesn't open the file", async () => {
    const refusal = new Error('Zweite Hauptdatei');
    mocks.documentsApi.AddFile.mockRejectedValueOnce(refusal);
    const onOpen = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'addFile' }));
    fireEvent.change(await nameField(), { target: { value: 'main.mjs' } });
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.documentsApi.AddFile).toHaveBeenCalledWith('main.mjs');
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(refusal, 'fileChangeFailed'),
    );
    expect(onOpen).not.toHaveBeenCalled();
  });
});
