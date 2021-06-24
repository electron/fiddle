import { mount, shallow } from 'enzyme';
import * as React from 'react';

import {
  DefaultEditorId,
  GenericDialogType,
  MAIN_JS,
} from '../../../src/interfaces';
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

  it('disables hide button if only one editor open', () => {
    const file = 'file.js';
    const content = '// content';
    editorMosaic.set({ [file]: content });
    editorMosaic.addEditor(file, new MonacoEditorMock() as any);

    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const instance = wrapper.instance() as EditorDropdown;
    const menu = instance.renderMenuItems();

    expect(menu).toMatchSnapshot();
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
    const badFile = 'main.js';

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
      label: `Custom editor name ${badFile} already exists - duplicates are not allowed`,
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
      label:
        'Invalid custom editor name - must be either an html, js, or css file.',
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
