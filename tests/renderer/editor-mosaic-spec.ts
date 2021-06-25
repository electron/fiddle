import {
  DefaultEditorId,
  EditorId,
  EditorValues,
  MAIN_JS,
} from '../../src/interfaces';
import {
  EditorMosaic,
  createMosaicArrangement,
  EditorPresence,
} from '../../src/renderer/editor-mosaic';
import { getEmptyContent } from '../../src/utils/editor-utils';
import {
  AppMock,
  MonacoEditorMock,
  MonacoMock,
  createEditorValues,
} from '../mocks/mocks';
import { waitFor } from '../../src/utils/wait-for';

describe('EditorMosaic', () => {
  let editorMosaic: EditorMosaic;
  let valuesIn: EditorValues;
  let monaco: MonacoMock;
  let editor: MonacoEditorMock;
  let app: AppMock;

  beforeEach(() => {
    ({ app, monaco } = (window as any).ElectronFiddle);

    // inject a real EditorMosaic into our mock scaffolding
    editorMosaic = new EditorMosaic();
    app.state.editorMosaic = editorMosaic as any;

    editor = new MonacoEditorMock();
    valuesIn = createEditorValues();
  });

  describe('addEditor()', () => {
    const id = MAIN_JS;
    const content = '// content';

    beforeEach(() => {
      editorMosaic.set({ [id]: content });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);
    });

    it('makes a file visible', () => {
      editorMosaic.addEditor(id, editor as any);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);
    });

    it('begins listening for changes to the files', () => {
      // test that isEdited is not affected by editors that aren't in the
      // mosaic (`editor` hasn't been added to the mosaic yet)
      expect(editorMosaic.isEdited).toBe(false);
      editor.setValue('💩');
      expect(editorMosaic.isEdited).toBe(false);

      // test that isEdited is affected by editors that have been added
      editorMosaic.addEditor(id, editor as any);
      expect(editorMosaic.isEdited).toBe(false);
      editor.setValue('💩');
      expect(editorMosaic.isEdited).toBe(true);
    });

    describe('does not change isEdited', () => {
      it.each([true, false])('...to %p', (value: boolean) => {
        // test that isEdited does not change when adding editors
        editorMosaic.isEdited = value;
        expect(editorMosaic.isEdited).toBe(value);
        editorMosaic.addEditor(id, editor as any);
        expect(editorMosaic.isEdited).toBe(value);
      });
    });

    it('restores ViewStates when possible', () => {
      // setup: put visible file into the mosaic and then hide it.
      // this should cause EditorMosaic to cache the viewstate offscreen.
      const viewState = Symbol('some unique viewstate');
      editor.saveViewState.mockReturnValueOnce(viewState);
      editorMosaic.addEditor(id, editor as any);
      editorMosaic.hide(id);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);

      // now try to re-show the file
      const editor2 = new MonacoEditorMock();
      editorMosaic.show(id);
      editorMosaic.addEditor(id, editor2 as any);

      // test that the viewState was reused in the new editor
      expect(editor2.restoreViewState).toHaveBeenCalledWith(viewState);
    });

    it('restores values when possible', () => {
      editorMosaic.addEditor(id, editor as any);
      expect(monaco.editor.createModel).toHaveBeenCalledWith(
        content,
        expect.anything(),
      );
    });

    it('sets a fixed tab size', () => {
      editorMosaic.addEditor(id, editor as any);
      expect(monaco.latestModel.updateOptions).toHaveBeenCalledWith(
        expect.objectContaining({ tabSize: 2 }),
      );
    });
  });

  describe('numVisible', () => {
    const id = MAIN_JS;
    const hiddenContent = getEmptyContent(id);
    const visibleContent = '// fnord' as const;

    it('excludes hidden files', () => {
      editorMosaic.set({ [id]: hiddenContent });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
      expect(editorMosaic.numVisible).toBe(0);
    });

    it('includes pending files', () => {
      editorMosaic.set({ [id]: visibleContent });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);
      expect(editorMosaic.numVisible).toBe(1);
    });

    it('includes visible files', () => {
      editorMosaic.set({ [id]: visibleContent });
      editorMosaic.addEditor(id, editor as any);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);
      expect(editorMosaic.numVisible).toBe(1);
    });
  });

  describe('hide()', () => {
    it('hides an editor', () => {
      const id = MAIN_JS;
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(id, editor as any);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);

      editorMosaic.hide(MAIN_JS);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });
  });

  describe('show()', () => {
    it('shows an editor', () => {
      const id = MAIN_JS;
      editorMosaic.set({ [id]: getEmptyContent(id) });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);

      editorMosaic.show(MAIN_JS);
      expect(editorMosaic.files.get(id)).not.toBe(EditorPresence.Hidden);
    });
  });

  describe('toggle()', () => {
    const id = MAIN_JS;
    const hiddenContent = getEmptyContent(id);
    const visibleContent = '// sesquipedalian';

    it('shows files that were hidden', () => {
      editorMosaic.set({ [id]: hiddenContent });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);

      editorMosaic.toggle(id);
      expect(editorMosaic.files.get(id)).not.toBe(EditorPresence.Hidden);
    });

    it('hides files that were visible', () => {
      editorMosaic.set({ [id]: visibleContent });
      editorMosaic.addEditor(id, editor as any);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);

      editorMosaic.toggle(id);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });

    it('hides files that were pending', () => {
      editorMosaic.set({ [id]: visibleContent });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);

      editorMosaic.toggle(id);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });
  });

  describe('removeCustomMosaic()', () => {
    it('removes a given custom mosaic', () => {
      const file = 'file.js';
      editorMosaic.customMosaics = [file];

      editorMosaic.removeCustomMosaic(file);
      expect(editorMosaic.customMosaics).toEqual([]);
    });
  });

  describe('resetLayout()', () => {
    it('resets editors to their original arrangement', () => {
      const serializeState = () => [...editorMosaic.files.entries()];

      // setup: capture the state of the editorMosaic after set() is called
      editorMosaic.set(valuesIn);
      const initialState = serializeState();

      // now change the state a bit
      for (const filename of Object.keys(valuesIn))
        editorMosaic.hide(filename as EditorId);
      expect(serializeState()).not.toStrictEqual(initialState);

      // test the post-reset state matches the initial state
      editorMosaic.resetLayout();
      expect(serializeState()).toStrictEqual(initialState);
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
        editorMosaic.addEditor(file as any, editor as any);
        editor.setValue(value);
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

    it('hides files that are empty', () => {
      const id = MAIN_JS;
      const content = '';
      editorMosaic.set({ [id]: content });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });

    it('hides files that have default content', () => {
      const id = MAIN_JS;
      const content = getEmptyContent(id);
      expect(content).not.toStrictEqual('');
      editorMosaic.set({ [id]: content });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });

    it('shows files that have non-default content', () => {
      const id = MAIN_JS;
      const content = 'fnord';
      editorMosaic.set({ [id]: content });
      expect(editorMosaic.files.get(id)).not.toBe(EditorPresence.Hidden);
    });

    it('reuses existing editors', () => {
      // setup: get a mosaic with a visible editor
      const id = MAIN_JS;
      let content = '// first content';
      editorMosaic.set({ [id]: content });
      editorMosaic.addEditor(id, editor as any);

      // now call set again, same filename DIFFERENT content
      content = '// second content';
      editorMosaic.set({ [id]: content });
      // test that editorMosaic set the editor to the new content
      expect(editor.getValue()).toBe(content);
      expect(editorMosaic.isEdited).toBe(false);

      // test that the editor still responds to edits
      content = '// third content';
      editor.setValue(content);
      expect(editorMosaic.isEdited).toBe(true);

      // now call set again, same filename and SAME content
      editorMosaic.set({ [id]: content });
      expect(editorMosaic.isEdited).toBe(false);

      // test that the editor still responds to edits
      content = '// fourth content';
      editor.setValue(content);
      expect(editorMosaic.isEdited).toBe(true);
    });

    it('does not add unrequested files', () => {
      editorMosaic.set(valuesIn);
      for (const key of editorMosaic.files.keys()) {
        expect(valuesIn).toHaveProperty([key]);
      }
    });

    it('uses the expected layout', () => {
      editorMosaic.set(valuesIn);
      expect(editorMosaic.mosaicArrangement).toStrictEqual({
        direction: 'row',
        first: {
          direction: 'column',
          first: 'main.js',
          second: 'renderer.js',
        },
        second: {
          direction: 'column',
          first: 'index.html',
          second: {
            direction: 'column',
            first: 'preload.js',
            second: 'styles.css',
          },
        },
      });
    });
  });

  describe('getEditorValue()', () => {
    const id = MAIN_JS;
    const content = '// content';
    const emptyContent = getEmptyContent(id);

    it('returns values for files that are hidden', () => {
      const value = emptyContent;
      editorMosaic.set({ [id]: value });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);

      expect(editorMosaic.getEditorValue(id)).toBe(value);
    });

    it('returns values for files that are pending', () => {
      const value = content;
      editorMosaic.set({ [id]: value });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);

      expect(editorMosaic.getEditorValue(id)).toBe(value);
    });

    it('returns values for files that are visible', () => {
      const value = content;
      editorMosaic.set({ [id]: value });
      editorMosaic.addEditor(id, editor as any);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);

      expect(editorMosaic.getEditorValue(id)).toBe(value);
    });

    it('returns an empty string if the editor does not exist', () => {
      expect(editorMosaic.getEditorValue('unknown.js')).toBe('');
    });
  });

  describe('focusedEditor', () => {
    it('finds the focused editor if there is one', () => {
      const id = MAIN_JS;
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(id, editor as any);
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
