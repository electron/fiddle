import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { EditorId, GenericDialogType, MAIN_JS } from '../../../src/interfaces';
import { EditorDropdown } from '../../../src/renderer/components/commands-editors';
import { getVisibleMosaics } from '../../../src/utils/editors-mosaic-arrangement';

jest.mock('../../../src/utils/editors-mosaic-arrangement');

describe('EditorDropdown component', () => {
  let store: any;
  let initialMosaics: EditorId[];
  let visibleMosaics: EditorId[];

  beforeEach(() => {
    initialMosaics = [MAIN_JS];
    visibleMosaics = [...initialMosaics];
    store = {
      allMosaics: [...initialMosaics],
      closedPanels: {},
      hideAndBackupMosaic: jest.fn().mockImplementation((id: EditorId) => {
        store.closedPanels[id] = true;
        visibleMosaics = visibleMosaics.filter((x: EditorId) => x !== id);
      }),
      removeMosaic: jest.fn().mockImplementation((id: EditorId) => {
        visibleMosaics = visibleMosaics.filter((x: EditorId) => x !== id);
        store.allMosaics = store.allMosaics.filter((x: EditorId) => x !== id);
      }),
      setGenericDialogOptions: jest.fn(),
      showMosaic: jest.fn(),
      toggleGenericDialog: jest.fn(),
    };

    (getVisibleMosaics as jest.Mock).mockImplementation(() => visibleMosaics);
  });

  afterEach(() => {
    store = {
      allMosaics: [],
      closedPanels: {},
      genericDialogLastInput: undefined,
    };
  });

  it('renders', () => {
    const wrapper = shallow(<EditorDropdown appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click for an item', () => {
    const id = initialMosaics[0];
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.onItemClick({ currentTarget: { id } } as any);
    expect(store.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    expect(store.showMosaic).toHaveBeenCalledTimes(0);

    dropdown.onItemClick({ currentTarget: { id } } as any);
    expect(store.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    expect(store.showMosaic).toHaveBeenCalledTimes(1);
  });

  it('disables hide button if only one editor open', () => {
    store.mosaicArrangement = MAIN_JS;
    // (getVisibleMosaics as jest.Mock).mockReturnValue([DefaultEditorId.html]);

    const wrapper = mount(<EditorDropdown appState={store} />);
    const instance = wrapper.instance() as EditorDropdown;
    const menu = instance.renderMenuItems();

    expect(menu).toMatchSnapshot();
  });

  it('can add a valid editor', async () => {
    const file = 'file.js';

    store.showEditorDialog = jest
      .fn()
      .mockReturnValue({ cancelled: false, result: file });
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = file;
    store.genericDialogLastResult = true;

    await dropdown.addEditor();

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(1, {
      type: GenericDialogType.confirm,
      label: 'Enter a filename to add',
      cancel: 'Cancel',
      placeholder: 'file.js',
      ok: 'Create',
      wantsInput: true,
    });

    expect(store.showMosaic).toHaveBeenCalledTimes(1);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(1);
    expect([...store.allMosaics].sort()).toEqual(
      [...initialMosaics, file].sort(),
    );
  });

  it('errors when trying to add a duplicate editor', async () => {
    const dupe = initialMosaics[0];

    store.showEditorDialog = jest
      .fn()
      .mockReturnValue({ cancelled: false, result: dupe });
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = dupe;
    store.genericDialogLastResult = true;

    await dropdown.addEditor();

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(1, {
      type: GenericDialogType.confirm,
      label: 'Enter a filename to add',
      cancel: 'Cancel',
      placeholder: 'file.js',
      ok: 'Create',
      wantsInput: true,
    });

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(2, {
      type: GenericDialogType.warning,
      label: `Filename "${dupe}" already exists - duplicates are not allowed`,
      cancel: undefined,
    });

    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(2);
    expect(store.showMosaic).toHaveBeenCalledTimes(0);
    expect(store.allMosaics).toEqual(initialMosaics);
  });

  it('errors when trying to add an invalid editor', async () => {
    const badFile = '💀.💩';

    store.showEditorDialog = jest
      .fn()
      .mockReturnValue({ cancelled: false, result: badFile });
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    store.genericDialogLastInput = badFile;
    store.genericDialogLastResult = true;

    await dropdown.addEditor();

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(1, {
      cancel: 'Cancel',
      label: 'Enter a filename to add',
      ok: 'Create',
      placeholder: 'file.js',
      type: GenericDialogType.confirm,
      wantsInput: true,
    });

    expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(2, {
      cancel: undefined,
      label: 'Invalid editor name - must be either an html, js, or css file.',
      type: GenericDialogType.warning,
    });

    expect(store.showMosaic).toHaveBeenCalledTimes(0);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(2);
    expect(store.allMosaics).toEqual(initialMosaics);
  });

  it('can remove an editor', () => {
    const file = 'file.js';
    store.allMosaics = [file];

    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.removeMosaic({
      currentTarget: { id: file },
    } as any);

    expect(store.removeMosaic).toHaveBeenCalledTimes(1);
  });
});
