import * as React from 'react';
import { mount, shallow } from 'enzyme';

import { EditorId, GenericDialogType } from '../../../src/interfaces';
import { EditorDropdown } from '../../../src/renderer/components/commands-editors';
import { EditorMosaic, EditorState } from '../../../src/renderer/editor-mosaic';

import { AppMock } from '../../mocks/app';
import { MonacoEditorMock } from '../../mocks/monaco-editor';
import { createEditorValues } from '../../mocks/editor-values';

describe('EditorDropdown component', () => {
  let app: AppMock;
  let store: any;
  let editorMosaic: EditorMosaic;

  beforeEach(() => {
    app = new AppMock();
    editorMosaic = new EditorMosaic(app as any);
    store = {
      setGenericDialogOptions: jest.fn(),
      toggleGenericDialog: jest.fn(),
    };
  });

  afterEach(() => {
    store = {
      allMosaics: [],
      closedPanels: {},
      genericDialogLastInput: undefined,
    };
  });

  // helper:
  // create a mosaic with numFiles files total, numVisible of which are showing
  function setupMosaic(numFiles: number, numVisible: number) {
    const allValues = createEditorValues();
    const filenames = Object.keys(allValues).slice(0, numFiles) as EditorId[];

    const editorValues = {};
    filenames.forEach((name) => (editorValues[name] = allValues[name]));
    editorMosaic.set(editorValues);

    const editors: MonacoEditorMock[] = [];
    for (let i = 0; i < numVisible; ++i) {
      const editor = new MonacoEditorMock();
      editorMosaic.addEditor(filenames[i], editor as any);
      editors.push(editor);
    }

    return { allValues, filenames, editorValues, editors };
  }

  // helper: create the react component
  function createEditorDropdown(shallowOrMount: any) {
    const wrapper = shallowOrMount(
      <EditorDropdown appState={store} editorMosaic={editorMosaic} />,
    );
    const dropdown = wrapper.instance() as EditorDropdown;
    return { dropdown, wrapper };
  }

  it('renders', () => {
    setupMosaic(1, 1);
    const { wrapper } = createEditorDropdown(shallow);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click for an item', () => {
    const { filenames } = setupMosaic(2, 2);
    const { dropdown } = createEditorDropdown(mount);
    const id = filenames[0];
    const click = () => dropdown.onItemClick({ currentTarget: { id } } as any);

    click();
    expect(editorMosaic.states.get(id)).toBe(EditorState.Hidden);

    click();
    expect(editorMosaic.states.get(id)).not.toBe(EditorState.Hidden);
  });

  it('disables hide button if only one editor open', () => {
    setupMosaic(1, 1);
    const { dropdown } = createEditorDropdown(mount);
    const menu = dropdown.renderMenuItems();
    expect(menu).toMatchSnapshot();
  });

  describe('adding a new file', () => {
    // helper: pop up the dialog, enter a file, and click a button
    async function addFileDialog(
      dropdown: EditorDropdown,
      confirm: boolean,
      file: EditorId,
    ) {
      store.showEditorDialog = jest
        .fn()
        .mockReturnValue({ cancelled: false, result: file });
      store.genericDialogLastInput = file;
      store.genericDialogLastResult = confirm;
      await dropdown.addEditor();
      expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(1, {
        cancel: 'Cancel',
        label: 'Enter a filename to add',
        ok: 'Create',
        placeholder: 'file.js',
        type: GenericDialogType.confirm,
        wantsInput: true,
      });
    }

    it('succeeds for supported files', async () => {
      setupMosaic(1, 1);
      const { dropdown } = createEditorDropdown(mount);
      const file = 'newFile.js';
      await addFileDialog(dropdown, true, file);

      expect(store.toggleGenericDialog).toHaveBeenCalledTimes(1);
      expect(editorMosaic.states.get(file)).toBe(EditorState.Pending);
    });

    it('fails when trying to add a duplicate file', async () => {
      const { filenames } = setupMosaic(1, 1);
      const { dropdown } = createEditorDropdown(mount);
      const file = filenames[0];
      await addFileDialog(dropdown, true, file);

      expect(store.toggleGenericDialog).toHaveBeenCalledTimes(2);
      expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(2, {
        cancel: undefined,
        label: `Cannot add duplicate file "${file}"`,
        type: GenericDialogType.warning,
      });
    });

    it('fails when trying to add an unsupported file', async () => {
      setupMosaic(1, 1);
      const { dropdown } = createEditorDropdown(mount);
      const file = 'index.php';
      await addFileDialog(dropdown, true, file as EditorId);

      expect(store.toggleGenericDialog).toHaveBeenCalledTimes(2);
      expect(store.setGenericDialogOptions).toHaveBeenNthCalledWith(2, {
        cancel: undefined,
        label: 'File must be either js, html, or css.',
        type: GenericDialogType.warning,
      });
    });
  });

  it('can remove an editor', () => {
    const { filenames } = setupMosaic(2, 2);
    const { dropdown } = createEditorDropdown(mount);
    const file = filenames[0];

    expect(editorMosaic.states.has(file)).toBe(true);
    dropdown.removeEditor({ currentTarget: { id: file } } as any);
    expect(editorMosaic.states.has(file)).toBe(false);
  });
});
