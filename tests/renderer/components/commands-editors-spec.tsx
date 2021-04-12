import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { DefaultEditorId, GenericDialogType } from '../../../src/interfaces';
import { EditorDropdown } from '../../../src/renderer/components/commands-editors';
import { getVisibleMosaics } from '../../../src/utils/editors-mosaic-arrangement';

jest.mock('../../../src/utils/editors-mosaic-arrangement');

describe('EditorDropdown component', () => {
  let store: any;

  beforeEach(() => {
    (process.env as any).FIDDLE_DOCS_DEMOS = false;

    store = {
      hideAndBackupMosaic: jest.fn(),
      setGenericDialogOptions: jest.fn(),
      removeCustomMosaic: jest.fn(),
      showMosaic: jest.fn(),
      toggleGenericDialog: jest.fn(),
      closedPanels: {},
      customMosaics: [],
    };

    (getVisibleMosaics as jest.Mock).mockReturnValue([
      DefaultEditorId.html,
      DefaultEditorId.renderer,
    ]);
  });

  afterEach(() => {
    store = {
      genericDialogLastInput: undefined,
      closedPanels: {},
      customMosaics: [],
    };
  });

  it('renders', () => {
    const wrapper = shallow(<EditorDropdown appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the extra button if the FIDDLE_DOCS_DEMOS is set', () => {
    (process.env as any).FIDDLE_DOCS_DEMOS = true;

    const wrapper = shallow(<EditorDropdown appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click for an item', () => {
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.onItemClick({
      currentTarget: { id: DefaultEditorId.html },
    } as any);
    expect(store.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    expect(store.showMosaic).toHaveBeenCalledTimes(0);

    dropdown.onItemClick({
      currentTarget: { id: DefaultEditorId.main },
    } as any);
    expect(store.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    expect(store.showMosaic).toHaveBeenCalledTimes(1);
  });

  it('disables hide button if only one editor open', () => {
    store.mosaicArrangement = 'html';
    (getVisibleMosaics as jest.Mock).mockReturnValue([DefaultEditorId.html]);

    const wrapper = mount(<EditorDropdown appState={store} />);
    const instance = wrapper.instance() as EditorDropdown;
    const menu = instance.renderMenuItems();

    expect(menu).toMatchSnapshot();
  });

  it('can add a valid custom editor', async () => {
    const file = 'file.js';

    store.showCustomEditorDialog = jest.fn().mockReturnValue(file);
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = file;

    await dropdown.addCustomEditor();

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(1, {
      type: GenericDialogType.confirm,
      label: 'Enter a filename for your custom editor',
      cancel: 'Cancel',
      placeholder: 'file.js',
      ok: 'Create',
      wantsInput: true,
    });

    expect(store.showMosaic).toHaveBeenCalledTimes(1);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(1);
    expect(store.customMosaics).toEqual([file]);
  });

  it('errors when trying to add a duplicate custom editor', async () => {
    const badFile = 'main.js';

    store.showCustomEditorDialog = jest.fn().mockReturnValue(badFile);
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = badFile;

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
    expect(store.showMosaic).toHaveBeenCalledTimes(0);
    expect(store.customMosaics).toEqual([]);
  });

  it('errors when trying to add an invalid custom editor', async () => {
    const badFile = 'bad.bad';

    store.showCustomEditorDialog = jest.fn().mockReturnValue(badFile);
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = badFile;

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

    expect(store.showMosaic).toHaveBeenCalledTimes(0);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(2);
    expect(store.customMosaics).toEqual([]);
  });

  it('can remove a custom editor', () => {
    const file = 'file.js';
    store.customMosaics = [file];

    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.removeCustomEditor({
      currentTarget: { id: file },
    } as any);

    expect(store.removeCustomMosaic).toHaveBeenCalledTimes(1);
  });
});
