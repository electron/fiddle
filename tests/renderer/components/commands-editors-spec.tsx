import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { DefaultEditorId, GenericDialogType } from '../../../src/interfaces';
import { EditorDropdown } from '../../../src/renderer/components/commands-editors';

import { EditorMosaicMock, StateMock } from '../../mocks/mocks';

jest.mock('../../../src/utils/editors-mosaic-arrangement');

describe('EditorDropdown component', () => {
  let store: StateMock;
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    (process.env as any).FIDDLE_DOCS_DEMOS = false;
    ({ state: store } = (window as any).ElectronFiddle.app);
    ({ editorMosaic } = store);

    editorMosaic.getVisibleMosaics.mockReturnValue([
      DefaultEditorId.html,
      DefaultEditorId.renderer,
    ]);
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
    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;
    const { editorMosaic } = store;

    dropdown.onItemClick({
      currentTarget: { id: DefaultEditorId.html },
    } as any);
    expect(editorMosaic.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    expect(editorMosaic.showMosaic).toHaveBeenCalledTimes(0);

    dropdown.onItemClick({
      currentTarget: { id: DefaultEditorId.main },
    } as any);
    expect(editorMosaic.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    expect(editorMosaic.showMosaic).toHaveBeenCalledTimes(1);
  });

  it('disables hide button if only one editor open', () => {
    const { editorMosaic } = store;

    editorMosaic.mosaicArrangement = DefaultEditorId.html;
    editorMosaic.getVisibleMosaics.mockReturnValue([DefaultEditorId.html]);

    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const instance = wrapper.instance() as EditorDropdown;
    const menu = instance.renderMenuItems();

    expect(menu).toMatchSnapshot();
  });

  it('can add a valid custom editor', async () => {
    const { editorMosaic } = store;
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

    expect(editorMosaic.showMosaic).toHaveBeenCalledTimes(1);
    expect(editorMosaic.customMosaics).toEqual([file]);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(1);
  });

  it('errors when trying to add a duplicate custom editor', async () => {
    const { editorMosaic } = store;
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
    expect(editorMosaic.showMosaic).toHaveBeenCalledTimes(0);
    expect(editorMosaic.customMosaics).toEqual([]);
  });

  it('errors when trying to add an invalid custom editor', async () => {
    const { editorMosaic } = store;
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
    expect(editorMosaic.showMosaic).toHaveBeenCalledTimes(0);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(2);
  });

  it('can remove a custom editor', () => {
    const { editorMosaic } = store;
    const file = 'file.js';
    editorMosaic.customMosaics = [file];

    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.removeCustomEditor({
      currentTarget: { id: file },
    } as any);

    expect(editorMosaic.removeCustomMosaic).toHaveBeenCalledTimes(1);
  });
});
