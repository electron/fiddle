import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { DefaultEditorId } from '../../../src/interfaces';
import { EditorDropdown } from '../../../src/renderer/components/commands-editors';

import { EditorMosaicMock, StateMock } from '../../mocks/mocks';

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
    const file = 'file.js';
    store.showInputDialog = jest.fn().mockResolvedValueOnce(file);
    store.showErrorDialog = jest.fn().mockResolvedValueOnce(undefined);

    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;
    await dropdown.addCustomEditor();

    expect(store.showInputDialog).toHaveBeenCalledWith({
      cancel: 'Cancel',
      label: 'Enter a filename for your custom editor',
      ok: 'Create',
      placeholder: 'file.js',
    });

    const { editorMosaic } = store;
    expect(editorMosaic.showMosaic).toHaveBeenCalledTimes(1);
    expect(editorMosaic.customMosaics).toEqual([file]);
  });

  it('errors when trying to add a duplicate custom editor', async () => {
    const dupe = DefaultEditorId.html;
    store.showInputDialog = jest.fn().mockResolvedValueOnce(dupe);
    store.showErrorDialog = jest.fn().mockResolvedValueOnce(undefined);

    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;
    await dropdown.addCustomEditor();

    expect(store.showInputDialog).toHaveBeenCalledWith({
      cancel: 'Cancel',
      label: 'Enter a filename for your custom editor',
      ok: 'Create',
      placeholder: 'file.js',
    });

    expect(store.showErrorDialog).toHaveBeenCalledWith(
      `Custom editor name ${dupe} already exists - duplicates are not allowed`,
    );

    const { editorMosaic } = store;
    expect(editorMosaic.showMosaic).toHaveBeenCalledTimes(0);
    expect(editorMosaic.customMosaics).toEqual([]);
  });

  it('errors when trying to add an invalid custom editor', async () => {
    const badFile = 'bad.bad';
    store.showInputDialog = jest.fn().mockResolvedValueOnce(badFile);
    store.showErrorDialog = jest.fn().mockResolvedValueOnce(undefined);

    const wrapper = mount(<EditorDropdown appState={store as any} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    await dropdown.addCustomEditor();

    expect(store.showInputDialog).toHaveBeenCalledWith({
      cancel: 'Cancel',
      label: 'Enter a filename for your custom editor',
      ok: 'Create',
      placeholder: 'file.js',
    });

    expect(store.showErrorDialog).toHaveBeenCalledWith(
      expect.stringMatching(/invalid editor name/i),
    );

    const { editorMosaic } = store;
    expect(editorMosaic.customMosaics).toEqual([]);
    expect(editorMosaic.showMosaic).toHaveBeenCalledTimes(0);
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
