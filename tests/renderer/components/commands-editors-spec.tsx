import { mount, shallow } from 'enzyme';
import * as React from 'react';
import { isSupportedFile } from '../../../src/utils/editor-utils';

import { AppState } from '../../../src/renderer/state';
import { EditorId, MAIN_JS } from '../../../src/interfaces';
import { EditorDropdown } from '../../../src/renderer/components/commands-editors';
import {
  EditorMosaic,
  EditorPresence,
} from '../../../src/renderer/editor-mosaic';
import {
  MonacoEditorMock,
  StateMock,
  createEditorValues,
} from '../../mocks/mocks';

describe('EditorDropdown component', () => {
  let store: StateMock;
  let editorMosaic: EditorMosaic;
  let toggleSpy: ReturnType<typeof jest.spyOn>;
  let showSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    editorMosaic = new EditorMosaic();
    editorMosaic.set(createEditorValues());
    showSpy = jest.spyOn(editorMosaic, 'show');
    toggleSpy = jest.spyOn(editorMosaic, 'toggle');

    ({ state: store } = (window as any).ElectronFiddle.app);
    store.editorMosaic = editorMosaic as any;
  });

  it('renders', () => {
    const wrapper = shallow(<EditorDropdown appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the extra button if the FIDDLE_DOCS_DEMOS is set', () => {
    (process.env as any).FIDDLE_DOCS_DEMOS = true;

    const wrapper = shallow(<EditorDropdown appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click for an item', () => {
    const id = MAIN_JS;
    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.onItemClick({ currentTarget: { id } } as any);
    expect(toggleSpy).toHaveBeenCalledTimes(1);

    dropdown.onItemClick({ currentTarget: { id } } as any);
    expect(toggleSpy).toHaveBeenCalledTimes(2);
  });

  function renderFileMenuItems(appState: AppState) {
    const wrapper = mount(<EditorDropdown appState={appState} />);
    const instance = wrapper.instance() as EditorDropdown;
    const rendered = instance.renderMenuItems();
    return rendered.filter((item) => isSupportedFile(item.props?.id));
  }

  it('disables hide button for the last visible editor', () => {
    // setup: confirm we're rendering a menu for a mosaic with >1 visible files
    const values = editorMosaic.values();
    const filenames = Object.keys(values);
    for (const id of filenames)
      editorMosaic.addEditor(id as EditorId, new MonacoEditorMock() as any);
    expect(filenames.length).toBeGreaterThan(1);
    expect(editorMosaic.numVisible).toBeGreaterThan(1);
    expect(editorMosaic.numVisible).toBe(filenames.length);

    // test part 1: confirm the toggle menuitems should all be enabled
    let menuItems = renderFileMenuItems(store as any);
    expect(menuItems.length).toBe(Object.keys(values).length);
    expect(menuItems.every((item) => !item.props.disabled)).toBe(true);

    // setup: now hide all but one of the files
    const hiddenFiles = Object.keys(values);
    const visibleFile = hiddenFiles.pop() as EditorId;
    for (const file of hiddenFiles) editorMosaic.hide(file as EditorId);
    expect(editorMosaic.numVisible).toBe(1);
    expect(editorMosaic.files.get(visibleFile)).toBe(EditorPresence.Visible);

    // test part 2: test that the last visible file's button is disabled
    // and all the others are still enabled.
    menuItems = renderFileMenuItems(store as any);
    for (const item of menuItems) {
      expect(item.props.disabled).toBe(item.props.id === visibleFile);
    }
  });

  describe('addNewFile()', () => {
    function createEditorDropdown() {
      const wrapper = mount(
        <EditorDropdown appState={(store as unknown) as AppState} />,
      );
      const dropdown = wrapper.instance() as EditorDropdown;
      return { dropdown, wrapper };
    }

    it('can add a new file', async () => {
      // setup: pick a file id that's new to editorMosaic
      const file = 'file.js';
      store.showInputDialog = jest.fn().mockResolvedValueOnce(file);
      const addSpy = jest.spyOn(editorMosaic, 'addNewFile');
      expect(editorMosaic.files.has(file)).toBe(false);

      const { dropdown } = createEditorDropdown();
      await dropdown.addNewFile();

      expect(store.showInputDialog).toHaveBeenCalledWith({
        label: 'Enter a name for your new file',
        ok: 'Create',
        placeholder: 'file.js',
      });
      expect(addSpy).toHaveBeenCalledTimes(1);
      expect(showSpy).toHaveBeenCalledTimes(1);
      expect(editorMosaic.files.has(file)).toBe(true);
    });

    it('does not add a file if user cancels', async () => {
      store.showInputDialog = jest.fn().mockReturnValue(undefined);
      const { dropdown } = createEditorDropdown();

      await dropdown.addNewFile();
      expect(store.showInputDialog).toHaveBeenCalled();
      expect(store.showErrorDialog).not.toHaveBeenCalled();
      expect(showSpy).not.toHaveBeenCalled();
    });

    it('does not add duplicate files', async () => {
      // setup: pick a file id that's already in editorMosaic
      const dupe = Object.keys(editorMosaic.values()).pop();
      store.showInputDialog = jest.fn().mockReturnValue(dupe);
      expect(editorMosaic.files.has(dupe as EditorId)).toBe(true);

      const { dropdown } = createEditorDropdown();
      await dropdown.addNewFile();

      expect(store.showInputDialog).toHaveBeenCalledWith({
        label: 'Enter a name for your new file',
        ok: 'Create',
        placeholder: 'file.js',
      });
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/file already exists/i),
      );
      expect(showSpy).not.toHaveBeenCalled();
    });

    it('does not add unsupported files', async () => {
      // setup: pick a file that is not supported
      const badFile = 'unsupported.cpp' as EditorId;
      store.showInputDialog = jest.fn().mockResolvedValueOnce(badFile);
      store.showErrorDialog = jest.fn().mockResolvedValueOnce(undefined);
      expect(isSupportedFile(badFile)).toBe(false);

      const { dropdown } = createEditorDropdown();
      await dropdown.addNewFile();

      expect(store.showInputDialog).toHaveBeenCalledWith({
        label: 'Enter a name for your new file',
        ok: 'Create',
        placeholder: 'file.js',
      });
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/cannot add file/i),
      );
      expect(showSpy).not.toHaveBeenCalled();
      expect(store.editorMosaic.files.has(badFile)).toBe(false);
    });
  });

  it('can remove an editor', () => {
    const file = 'file.js';
    const content = '// content';
    const values = { ...createEditorValues(), [file]: content };
    editorMosaic.set(values);
    expect(editorMosaic.files.has(file)).toBe(true);

    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.removeFile({ currentTarget: { id: file } } as any);
    expect(editorMosaic.files.has(file)).toBe(false);
  });
});
