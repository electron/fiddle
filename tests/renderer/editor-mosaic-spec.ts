import {
  DEFAULT_EDITORS,
  DefaultEditorId,
  EditorId,
  EditorValues,
  MAIN_JS,
} from '../../src/interfaces';
import {
  EditorMosaic,
  createMosaicArrangement,
} from '../../src/renderer/editor-mosaic';
import {
  DEFAULT_MOSAIC_ARRANGEMENT,
  SORTED_EDITORS,
} from '../../src/renderer/constants';
import { compareEditors } from '../../src/utils/editor-utils';
import { MonacoEditorMock, createEditorValues } from '../mocks/mocks';
import { waitFor } from '../../src/utils/wait-for';

describe('EditorMosaic', () => {
  let editorMosaic: EditorMosaic;
  let valuesIn: EditorValues;
  let editor: MonacoEditorMock;

  beforeEach(() => {
    // inject a real EditorMosaic into our mock scaffolding
    editorMosaic = new EditorMosaic();
    (window as any).ElectronFiddle.app.state.editorMosaic = editorMosaic;

    editor = new MonacoEditorMock();
    valuesIn = createEditorValues();
  });

  describe('getAndRemoveEditorValueBackup()', () => {
    it('returns null if there is no backup', () => {
      const result = editorMosaic.getAndRemoveEditorValueBackup(
        DefaultEditorId.main,
      );
      expect(result).toEqual(undefined);
    });

    it('returns and deletes a backup if there is one', () => {
      editorMosaic.closedPanels[DefaultEditorId.main] = {
        testBackup: true,
      } as any;
      const result = editorMosaic.getAndRemoveEditorValueBackup(
        DefaultEditorId.main,
      );
      expect(result).toEqual({ testBackup: true });
      expect(editorMosaic.closedPanels[DefaultEditorId.main]).toBeUndefined();
    });
  });

  describe('setVisibleMosaics()', () => {
    it('updates the visible editors and creates a backup', () => {
      editorMosaic.mosaicArrangement = createMosaicArrangement(DEFAULT_EDITORS);
      editorMosaic.closedPanels = {};
      editorMosaic.customMosaics = [];
      editorMosaic.setVisibleMosaics([DefaultEditorId.main]);

      // we just need to mock something truthy here
      editorMosaic.addEditor(DefaultEditorId.main, editor as any);

      expect(editorMosaic.mosaicArrangement).toEqual(DefaultEditorId.main);
      expect(editorMosaic.closedPanels[DefaultEditorId.renderer]).toBeTruthy();
      expect(editorMosaic.closedPanels[DefaultEditorId.html]).toBeTruthy();
      expect(editorMosaic.closedPanels[DefaultEditorId.main]).toBeUndefined();
    });
  });

  describe('removeCustomMosaic()', () => {
    it('removes a given custom mosaic', () => {
      const file = 'file.js';
      editorMosaic.mosaicArrangement = DEFAULT_MOSAIC_ARRANGEMENT;
      editorMosaic.customMosaics = [file];

      editorMosaic.removeCustomMosaic(file);

      expect(editorMosaic.customMosaics).toEqual([]);
    });
  });

  describe('hideAndBackupMosaic()', () => {
    it('hides a given editor and creates a backup', () => {
      editorMosaic.mosaicArrangement = DEFAULT_MOSAIC_ARRANGEMENT;
      editorMosaic.closedPanels = {};
      editorMosaic.hideAndBackupMosaic(SORTED_EDITORS[0]);

      expect(editorMosaic.mosaicArrangement).toEqual({
        direction: 'row',
        first: SORTED_EDITORS[1],
        second: {
          direction: 'column',
          first: SORTED_EDITORS[2],
          second: SORTED_EDITORS[3],
        },
      });

      const { closedPanels } = editorMosaic;
      expect(closedPanels[DefaultEditorId.main]).toBeTruthy();
      expect(closedPanels[DefaultEditorId.renderer]).toBeUndefined();
      expect(closedPanels[DefaultEditorId.html]).toBeUndefined();
    });
  });

  describe('showMosaic()', () => {
    it('shows a given editor', () => {
      editorMosaic.mosaicArrangement = DefaultEditorId.main;
      editorMosaic.showMosaic(DefaultEditorId.html);

      expect(editorMosaic.mosaicArrangement).toEqual({
        direction: 'row',
        first: DefaultEditorId.main,
        second: DefaultEditorId.html,
      });
    });
  });

  describe('resetEditorLayout()', () => {
    it('Puts editors in default arrangement', () => {
      editorMosaic.hideAndBackupMosaic(SORTED_EDITORS[0]);

      expect(editorMosaic.mosaicArrangement).toEqual({
        direction: 'row',
        first: SORTED_EDITORS[1],
        second: {
          direction: 'column',
          first: SORTED_EDITORS[2],
          second: SORTED_EDITORS[3],
        },
      });

      editorMosaic.resetEditorLayout();

      expect(editorMosaic.mosaicArrangement).toEqual(
        DEFAULT_MOSAIC_ARRANGEMENT,
      );
    });
  });

  describe('values()', () => {
    it('works on closed panels', () => {
      const values = createEditorValues();
      editorMosaic.set(values);
      expect(editorMosaic.values()).toStrictEqual(values);
    });

    it('works on open panels', () => {
      const values = createEditorValues();
      editorMosaic.set(values);

      // now modify values _after_ calling editorMosaic.set()
      for (const [file, value] of Object.entries(values)) {
        values[file] = `${value} plus more text`;
      }

      // and then add Monaco editors
      for (const [file, value] of Object.entries(values)) {
        const editor = new MonacoEditorMock();
        editor.setValue(value);
        editorMosaic.addEditor(file as any, editor as any);
      }

      // values() should match the modified values
      expect(editorMosaic.values()).toStrictEqual(values);
    });
  });

  describe('set()', () => {
    it('resets isEdited to false', () => {
      editorMosaic.isEdited = true;
      editorMosaic.set(createEditorValues());
      expect(editorMosaic.isEdited).toBe(false);
    });

    it('only shows non-empty files', () => {
      const spy = jest.spyOn(editorMosaic, 'setVisibleMosaics');

      const values = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.css]: '/* Empty */',
        [DefaultEditorId.preload]: '',
      } as const;

      editorMosaic.set(values);
      expect(spy).toHaveBeenCalledWith([
        DefaultEditorId.main,
        DefaultEditorId.renderer,
        DefaultEditorId.html,
      ]);

      spy.mockRestore();
    });

    it('shows visible mosaics for non-empty editor contents with custom mosaics', () => {
      const spy = jest.spyOn(editorMosaic, 'setVisibleMosaics');

      const file = 'file.js';
      const values = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.css]: '/* Empty */',
        [DefaultEditorId.preload]: '',
        [file]: 'file-value',
      } as const;

      editorMosaic.set(values);
      expect(spy).toHaveBeenCalledWith([
        DefaultEditorId.main,
        DefaultEditorId.renderer,
        DefaultEditorId.html,
        file,
      ]);

      spy.mockRestore();
    });

    it('sorts the mosaics', () => {
      const spy = jest.spyOn(editorMosaic, 'setVisibleMosaics');

      // this order is defined inside the replaceFiddle() function
      const values = createEditorValues();
      editorMosaic.set(values);
      const expected = Object.keys(values).sort(compareEditors);
      expect(spy).toHaveBeenCalledWith(expected);

      spy.mockRestore();
    });

    it('attempts to set values', () => {
      const values: EditorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
      } as const;
      for (const filename of Object.keys(values)) {
        editorMosaic.addEditor(
          filename as EditorId,
          new MonacoEditorMock() as any,
        );
      }
      editorMosaic.set(values);

      for (const [filename, value] of Object.entries(values)) {
        const editor = editorMosaic.editors.get(filename as EditorId);
        expect(editor!.setValue).toHaveBeenCalledWith(value);
      }
    });

    it('attempts to set values for closed editors', () => {
      editorMosaic.editors.delete(DefaultEditorId.main);

      editorMosaic.set({
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.preload]: 'preload-value',
        [DefaultEditorId.css]: 'css-value',
      });

      expect(editorMosaic.closedPanels[DefaultEditorId.preload]).toEqual({
        value: 'preload-value',
      });
      expect(editorMosaic.closedPanels[DefaultEditorId.css]).toEqual({
        value: 'css-value',
      });
    });

    it('does not set a value if none passed in', () => {
      const id = DefaultEditorId.renderer;
      const oldValue = editorMosaic.getEditorValue(id);

      editorMosaic.set({
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
      });

      expect(editorMosaic.getEditorValue(id)).toBe(oldValue);
    });

    it('does not remember values from the previous call', () => {
      const id = DefaultEditorId.main;
      const content = '// content';
      editorMosaic.set({ [id]: content });
      expect(editorMosaic.getEditorValue(id)).toBe(content);

      editorMosaic.set({});
      expect(editorMosaic.getEditorValue(id)).not.toBe(content);
      expect(editorMosaic.getEditorValue(id)).toBe('');
    });
  });

  describe('getEditorValue()', () => {
    const filename = DefaultEditorId.html;
    const value = 'editor-value';

    beforeEach(() => {
      const editor = new MonacoEditorMock();
      editor.getValue.mockReturnValue(value);
      editorMosaic.addEditor(filename, editor as any);
    });

    it('returns the value for an editor if it exists', () => {
      expect(editorMosaic.getEditorValue(filename)).toBe(value);
    });

    it('returns the value for the editor backup if it exists', () => {
      // set up mock state that has the editor deleted and a backup
      editorMosaic.editors.delete(filename);
      const value = 'editor-backup-value';
      editorMosaic.closedPanels = { [filename]: { value } };

      expect(editorMosaic.getEditorValue(filename)).toBe(value);
    });

    it('returns an empty string if the editor does not exist', () => {
      editorMosaic.editors.delete(filename);
      expect(editorMosaic.getEditorValue(filename)).toBe('');
    });
  });

  describe('getEditorBackup()', () => {
    const filename = DefaultEditorId.html;
    const value = 'editor-value';

    beforeEach(() => {
      const editor = new MonacoEditorMock();
      editor.getValue.mockReturnValue(value);
      editorMosaic.addEditor(filename, editor as any);
    });

    it('returns the value for an editor', () => {
      const model = { testModel: true };
      const viewState = { testViewState: true };
      const value = 'editor-value';

      const editor = editorMosaic.editors.get(filename) as any;
      editor.model = model as any;
      editor.saveViewState.mockReturnValue(viewState);
      editor.value = value;

      expect(editorMosaic.getEditorBackup(filename)).toEqual({
        model,
        value,
        viewState,
      });
    });
  });

  describe('getEditorViewState()', () => {
    const filename = DefaultEditorId.html;

    it('returns the value for an editor', () => {
      const editor = new MonacoEditorMock();
      const viewState = { testViewState: true };
      editor.saveViewState.mockReturnValue(viewState);
      editorMosaic.addEditor(filename, editor as any);

      expect(editorMosaic.getEditorViewState(filename)).toBe(viewState);
    });

    it('returns null if the editor does not exist', () => {
      editorMosaic.editors.delete(filename);
      expect(editorMosaic.getEditorViewState(filename)).toBeNull();
    });
  });

  describe('getEditorModel()', () => {
    const filename = DefaultEditorId.html;

    beforeEach(() => {
      ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
    });

    it('returns the value for an editor', () => {
      const model = { testModel: true };
      const editor = new MonacoEditorMock();
      editor.getModel.mockReturnValue(model);
      editorMosaic.addEditor(filename, editor as any);

      expect(editorMosaic.getEditorModel(filename)).toBe(model);
    });

    it('returns null if the editor does not exist', () => {
      editorMosaic.editors.delete(filename);
      expect(editorMosaic.getEditorModel(filename)).toBeNull();
    });
  });

  describe('focusedEditor', () => {
    it('finds the focused editor if there is one', () => {
      const filename = MAIN_JS;
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(filename, editor as any);
      editor.hasTextFocus.mockReturnValue(true);

      expect(editorMosaic.focusedEditor()).toBe(editor);
    });

    it('returns undefined if none have focus', () => {
      editorMosaic.set(valuesIn);
      expect(editorMosaic.focusedEditor()).toBeUndefined();
    });
  });

  describe('layout', () => {
    it('layout() calls editor.layout() only once', async () => {
      const editor = new MonacoEditorMock();
      const filename = DefaultEditorId.html;
      await editorMosaic.addEditor(filename, editor as any);

      editorMosaic.layout();
      editorMosaic.layout();
      editorMosaic.layout();
      editorMosaic.layout();
      await waitFor(() => editor.layout.mock.calls.length > 0);

      expect(editor.layout).toHaveBeenCalledTimes(1);
    });
  });

  describe('disposeLayoutAutorun()', () => {
    it('automatically updates the layout when the mosaic arrangement changes', () => {
      const spy = jest.spyOn(editorMosaic, 'layout');
      editorMosaic.mosaicArrangement = DefaultEditorId.main;
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('createMosaicArrangement()', () => {
    it('creates the correct arrangement for one visible panel', () => {
      const result = createMosaicArrangement([DefaultEditorId.main]);

      expect(result).toEqual(DefaultEditorId.main);
    });

    it('creates the correct arrangement for two visible panels', () => {
      const result = createMosaicArrangement([
        DefaultEditorId.main,
        DefaultEditorId.renderer,
      ]);

      expect(result).toEqual({
        direction: 'row',
        first: DefaultEditorId.main,
        second: DefaultEditorId.renderer,
      });
    });

    it('creates the correct arrangement for the default visible panels', () => {
      const result = createMosaicArrangement(SORTED_EDITORS.slice(0, 4));

      expect(result).toEqual(DEFAULT_MOSAIC_ARRANGEMENT);
    });
  });

  describe('isEdited', () => {
    const id = MAIN_JS;
    let editor: MonacoEditorMock;

    beforeEach(() => {
      editor = new MonacoEditorMock();
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(id, editor as any);
      expect(editorMosaic.isEdited).toBe(false);
    });

    function testForIsEdited() {
      expect(editorMosaic.isEdited).toBe(false);

      editor.setValue(`${editor.getValue()} more text`);

      expect(editorMosaic.isEdited).toBe(true);
    }

    it('recognizes edits', () => {
      testForIsEdited();
    });

    it('recognizes edits after isEdited has been manually set to false', () => {
      editorMosaic.isEdited = false;
      testForIsEdited();
    });

    it('recognizes edits after isEdited has been manually toggled', () => {
      editorMosaic.isEdited = true;
      editorMosaic.isEdited = false;
      testForIsEdited();
    });
  });
});
