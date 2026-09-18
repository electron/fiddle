import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  documentsApi: {
    AddFile: vi.fn(() => Promise.resolve()),
    RenameFile: vi.fn(() => Promise.resolve()),
    RemoveFile: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../../ipc/renderer', () => ({ documentsApi: mocks.documentsApi }));
vi.mock('../packages/PackagesSection', () => ({ PackagesSection: () => null }));
// Sheet pulls in Monaco; the sidebar only needs its label keys.
vi.mock('../../shell/Sheet', () => ({
  processLabelKey: {
    main: 'processMain',
    preload: 'processPreload',
    renderer: 'processRenderer',
    other: 'processOther',
  },
  useBadgeLabel: () => () => undefined,
}));

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
        onSetVisible={vi.fn()}
      />
      <DialogHost />
    </>,
  );
  return onOpen;
}

const headings = () =>
  screen.getAllByRole('heading').map((heading) => heading.textContent);
const group = (key: string) => screen.getByRole('treegrid', { name: key });
const nameField = async () =>
  (await screen.findByRole('textbox', { name: 'fileName' })) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Sidebar groups', () => {
  it('always shows Main, Preload and Renderer, and Other only when it has files', () => {
    renderSidebar(['main.js']);
    expect(headings()).toEqual(['processMain', 'processPreload', 'processRenderer']);
    // An empty group is its head and add button, without an empty tree.
    expect(screen.queryByRole('treegrid', { name: 'processPreload' })).toBeNull();
    expect(screen.getByRole('button', { name: 'addPreloadFile' })).toBeTruthy();
  });

  it('lists helpers, pages and everything else under their groups', () => {
    renderSidebar([...TEMPLATE, 'main-menu.js', 'styles.css', 'data.json', 'utils.js']);
    expect(headings()).toEqual([
      'processMain',
      'processPreload',
      'processRenderer',
      'processOther',
    ]);
    expect(
      within(group('processMain')).getByRole('row', { name: /main-menu\.js/ }),
    ).toBeTruthy();
    expect(
      within(group('processRenderer')).getByRole('row', { name: /styles\.css/ }),
    ).toBeTruthy();
    const other = group('processOther');
    expect(within(other).getByRole('row', { name: /data\.json/ })).toBeTruthy();
    expect(within(other).getByRole('row', { name: /utils\.js/ })).toBeTruthy();
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
    expect(headings()).toEqual(['processMain', 'processPreload', 'processRenderer']);
    expect(screen.getByRole('row', { name: /renderer\.js/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /main\.js/ })).toBeTruthy();
  });
});

describe('Sidebar add in group', () => {
  it("opens the prompt with the group's hint and a free name, and adds it", async () => {
    const onOpen = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'addPreloadFile' }));
    expect((await nameField()).value).toBe('preload-2.js');
    expect(screen.getByText('groupHintPreload')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    await waitFor(() =>
      expect(mocks.documentsApi.AddFile).toHaveBeenCalledWith('preload-2.js'),
    );
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('preload-2.js'));
  });

  it('suggests a helper name for Main and takes a typed name from another group', async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'addMainFile' }));
    const input = await nameField();
    expect(input.value).toBe('main-2.js');
    fireEvent.change(input, { target: { value: 'about.html' } });
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    await waitFor(() =>
      expect(mocks.documentsApi.AddFile).toHaveBeenCalledWith('about.html'),
    );
  });

  it('starts empty for Other, and the generic Add file keeps the extension hint', async () => {
    renderSidebar([...TEMPLATE, 'data.json']);
    fireEvent.click(screen.getByRole('button', { name: 'addOtherFile' }));
    expect((await nameField()).value).toBe('');
    expect(screen.getByText('groupHintOther')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'addFile' }));
    expect((await nameField()).value).toBe('');
    expect(screen.getByText('fileNameHint')).toBeTruthy();
    // The prompt outlives the component (one DialogHost per window), so close it.
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.documentsApi.AddFile).not.toHaveBeenCalled();
  });

  it('checks the name before asking main', async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'addRendererFile' }));
    const input = await nameField();
    expect(input.value).toBe('renderer-2.js');
    // A second main entry breaks the file rules.
    fireEvent.change(input, { target: { value: 'main.mjs' } });
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.documentsApi.AddFile).not.toHaveBeenCalled();
  });
});
