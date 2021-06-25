import { mount, shallow } from 'enzyme';
import * as React from 'react';
// import { inspect } from 'util';
import { isSupportedFile } from '../../../src/utils/editor-utils';

import {
  DefaultEditorId,
  EditorId,
  GenericDialogType,
  MAIN_JS,
} from '../../../src/interfaces';
import { AppState } from '../../../src/renderer/state';
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
    editorMosaic.set({
      [DefaultEditorId.html]: `<!-- ${DefaultEditorId.html} -->`,
      [DefaultEditorId.renderer]: `// ${DefaultEditorId.renderer}`,
    });
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

  it('can add a valid custom editor', async () => {
    const file = 'file.js';

    store.showCustomEditorDialog = jest
      .fn()
      .mockReturnValue({ cancelled: false, result: file });
    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = file;
    store.genericDialogLastResult = true;

    await dropdown.addCustomEditor();

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(1, {
      type: GenericDialogType.confirm,
      label: 'Enter a filename for your custom editor',
      cancel: 'Cancel',
      placeholder: 'file.js',
      ok: 'Create',
      wantsInput: true,
    });

    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(editorMosaic.customMosaics).toEqual([file]);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(1);
  });

  it('errors when trying to add a duplicate custom editor', async () => {
    const dupe = Object.keys(editorMosaic.values()).pop();

    store.showCustomEditorDialog = jest
      .fn()
      .mockReturnValue({ cancelled: false, result: dupe });
    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = dupe!;
    store.genericDialogLastResult = true;

    await dropdown.addCustomEditor();

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(1, {
      type: GenericDialogType.confirm,
      label: 'Enter a filename for your custom editor',
      cancel: 'Cancel',
      placeholder: 'file.js',
      ok: 'Create',
      wantsInput: true,
    });

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(2, {
      type: GenericDialogType.warning,
      label: expect.stringMatching(/file already exists/i),
      cancel: undefined,
    });

    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(2);
    expect(showSpy).toHaveBeenCalledTimes(0);
    expect(editorMosaic.customMosaics).toEqual([]);
  });

  it('errors when trying to add an invalid custom editor', async () => {
    const badFile = 'bad.bad';

    store.showCustomEditorDialog = jest
      .fn()
      .mockReturnValue({ cancelled: false, result: badFile });
    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = badFile;
    store.genericDialogLastResult = true;

    await dropdown.addCustomEditor();

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(1, {
      type: GenericDialogType.confirm,
      label: 'Enter a filename for your custom editor',
      cancel: 'Cancel',
      placeholder: 'file.js',
      ok: 'Create',
      wantsInput: true,
    });

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(2, {
      type: GenericDialogType.warning,
      label: expect.stringMatching(/Must be \.js, \.html, or \.css/i),
      cancel: undefined,
    });

    expect(editorMosaic.customMosaics).toEqual([]);
    expect(showSpy).toHaveBeenCalledTimes(0);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(2);
  });

  it('can remove a custom editor', () => {
    const file = 'file.js';
    const content = '// content';
    const values = { ...createEditorValues(), [file]: content };
    editorMosaic.set(values);
    expect(editorMosaic.files.has(file)).toBe(true);

    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    console.log('--> calling dropdown.removeCustomEditor');
    dropdown.removeCustomEditor({
      currentTarget: { id: file },
    } as any);
    expect(editorMosaic.files.get(file)).toBe(EditorPresence.Hidden);
  });
});
