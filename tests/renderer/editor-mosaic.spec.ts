import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorId, EditorValues, MAIN_JS } from '../../src/interfaces';
import {
  Editor,
  EditorMosaic,
  EditorPresence,
} from '../../src/renderer/editor-mosaic';
import { getEmptyContent } from '../../src/utils/editor-utils';
import {
  AppMock,
  MonacoEditorMock,
  MonacoMock,
  createEditorValues,
} from '../mocks/mocks';

describe('EditorMosaic', () => {
  let editorMosaic: EditorMosaic;
  let valuesIn: EditorValues;
  let monaco: MonacoMock;
  let editor: Editor;
  let app: AppMock;

  beforeEach(() => {
    ({ app, monaco } = window as any);

    // inject a real EditorMosaic into our mock scaffolding
    editorMosaic = new EditorMosaic();
    app.state.editorMosaic = editorMosaic;

    editor = new MonacoEditorMock() as unknown as Editor;
    valuesIn = createEditorValues();
  });

  describe('addEditor()', () => {
    const id = MAIN_JS;
    const content = '// content';

    beforeEach(async () => {
      await editorMosaic.set({ [id]: content });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);
    });

    it('throws when called on an unexpected file', async () => {
      const otherId = 'file.js';
      await expect(() =>
        editorMosaic.addEditor(otherId, editor),
      ).rejects.toThrow(/unexpected file/i);
    });

    it('makes a file visible', async () => {
      await editorMosaic.addEditor(id, editor);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);
    });

    it('restores ViewStates when possible', async () => {
      // setup: put visible file into the mosaic and then hide it.
      // this should cause EditorMosaic to cache the viewstate offscreen.
      const viewState = Symbol('some unique viewstate');
      vi.mocked(editor.saveViewState).mockReturnValueOnce(viewState as any);
      await editorMosaic.addEditor(id, editor);
      editorMosaic.hide(id);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);

      // now try to re-show the file
      const editor2: Editor = new MonacoEditorMock() as unknown as Editor;
      editorMosaic.show(id);
      await editorMosaic.addEditor(id, editor2);

      // test that the viewState was reused in the new editor
      expect(editor2.restoreViewState).toHaveBeenCalledWith(viewState);
    });

    it('restores values when possible', async () => {
      await editorMosaic.addEditor(id, editor);
      expect(monaco.editor.createModel).toHaveBeenCalledWith(
        content,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('numVisible', () => {
    const id = MAIN_JS;
    const hiddenContent = getEmptyContent(id);
    const visibleContent = '// fnord' as const;

    it('excludes hidden files', async () => {
      await editorMosaic.set({ [id]: hiddenContent });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
      expect(editorMosaic.numVisible).toBe(0);
    });

    it('includes pending files', async () => {
      await editorMosaic.set({ [id]: visibleContent });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);
      expect(editorMosaic.numVisible).toBe(1);
    });

    it('includes visible files', async () => {
      await editorMosaic.set({ [id]: visibleContent });
      await editorMosaic.addEditor(id, editor);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);
      expect(editorMosaic.numVisible).toBe(1);
    });
  });

  describe('hide()', () => {
    it('hides an editor', async () => {
      const id = MAIN_JS;
      await editorMosaic.set(valuesIn);
      await editorMosaic.addEditor(id, editor);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);

      editorMosaic.hide(MAIN_JS);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });
  });

  describe('show()', () => {
    it('shows an editor', async () => {
      const id = MAIN_JS;
      await editorMosaic.set({ [id]: getEmptyContent(id) });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);

      editorMosaic.show(MAIN_JS);
      expect(editorMosaic.files.get(id)).not.toBe(EditorPresence.Hidden);
    });
  });

  describe('toggle()', () => {
    const id = MAIN_JS;
    const hiddenContent = getEmptyContent(id);
    const visibleContent = '// sesquipedalian';

    it('shows files that were hidden', async () => {
      await editorMosaic.set({ [id]: hiddenContent });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);

      editorMosaic.toggle(id);
      expect(editorMosaic.files.get(id)).not.toBe(EditorPresence.Hidden);
    });

    it('hides files that were visible', async () => {
      await editorMosaic.set({ [id]: visibleContent });
      await editorMosaic.addEditor(id, editor);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);

      editorMosaic.toggle(id);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });

    it('hides files that were pending', async () => {
      await editorMosaic.set({ [id]: visibleContent });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);

      editorMosaic.toggle(id);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });
  });

  describe('resetLayout()', () => {
    it('resets editors to their original arrangement', async () => {
      const serializeState = () => [...editorMosaic.files.entries()];

      // setup: capture the state of the editorMosaic after set() is called
      await editorMosaic.set(valuesIn);
      const initialState = serializeState();

      // now change the state a bit
      for (const filename of Object.keys(valuesIn)) {
        editorMosaic.hide(filename as EditorId);
      }
      expect(serializeState()).not.toStrictEqual(initialState);

      // test the post-reset state matches the initial state
      await editorMosaic.resetLayout();
      expect(serializeState()).toStrictEqual(initialState);
    });
  });

  describe('values()', () => {
    it('works on closed panels', async () => {
      const values = createEditorValues();
      await editorMosaic.set(values);
      expect(editorMosaic.values()).toStrictEqual(values);
    });

    it('works on open panels', async () => {
      const values = createEditorValues();
      await editorMosaic.set(values);

      // now modify values _after_ calling editorMosaic.set()
      for (const [file, value] of Object.entries(values)) {
        values[file as EditorId] = `${value} plus more text`;
      }

      // and then add Monaco editors
      for (const [file, value] of Object.entries(values)) {
        const editor = new MonacoEditorMock() as unknown as Editor;
        await editorMosaic.addEditor(file as EditorId, editor);
        editor.setValue(value);
      }

      // values() should match the modified values
      expect(editorMosaic.values()).toStrictEqual(values);
    });
  });

  describe('addNewFile()', () => {
    it('sets isEdited to true', async () => {
      await editorMosaic.set(createEditorValues());
      await editorMosaic.markAsSaved();
      expect(editorMosaic.isEdited).toBe(false);
      await editorMosaic.addNewFile('foo.js');
      expect(editorMosaic.isEdited).toBe(true);
    });
  });

  describe('renameFile()', () => {
    it('sets isEdited to true', async () => {
      await editorMosaic.set(createEditorValues());
      await editorMosaic.markAsSaved();
      expect(editorMosaic.isEdited).toBe(false);
      await editorMosaic.renameFile('renderer.js', 'bar.js');
      expect(editorMosaic.isEdited).toBe(true);
    });
  });

  describe('remove()', () => {
    it('sets isEdited to true', async () => {
      await editorMosaic.set(createEditorValues());
      await editorMosaic.markAsSaved();
      expect(editorMosaic.isEdited).toBe(false);
      await editorMosaic.remove('renderer.js');
      expect(editorMosaic.isEdited).toBe(true);
    });
  });

  describe('set()', () => {
    it('resets isEdited to false', async () => {
      await editorMosaic.set(valuesIn);
      editor.setValue('beep boop');
      vi.waitFor(() => editorMosaic.isEdited === true);

      await editorMosaic.set(createEditorValues());
      expect(editorMosaic.isEdited).toBe(false);
    });

    it('hides files that are empty', async () => {
      const id = MAIN_JS;
      const content = '';
      await editorMosaic.set({ [id]: content });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });

    it('hides files that have default content', async () => {
      const id = MAIN_JS;
      const content = getEmptyContent(id);
      expect(content).not.toStrictEqual('');
      await editorMosaic.set({ [id]: content });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
    });

    it('shows files that have non-default content', async () => {
      const id = MAIN_JS;
      const content = 'fnord';
      await editorMosaic.set({ [id]: content });
      expect(editorMosaic.files.get(id)).not.toBe(EditorPresence.Hidden);
    });

    it('does not set a value if none passed in', async () => {
      const id = MAIN_JS;
      await editorMosaic.set({ [id]: '// content' });
      expect(editorMosaic.files.has('some-file.js')).toBe(false);
    });

    describe('reuses existing editors', () => {
      it('when the old file was visible and the new one should be too', async () => {
        // setup: get a mosaic with a visible editor
        const id = MAIN_JS;
        let content = '// first content';
        await editorMosaic.set({ [id]: content });
        await editorMosaic.addEditor(id, editor);

        // now call set again, same filename DIFFERENT content
        content = '// second content';
        vi.mocked(monaco.editor.getModel).mockReturnValueOnce(
          monaco.latestModel,
        );
        await editorMosaic.set({ [id]: content });
        // test that editorMosaic set the editor to the new content
        expect(editor.getValue()).toBe(content);
        expect(editorMosaic.isEdited).toBe(false);

        // test that the editor still responds to edits
        content = '// third content';
        vi.mocked(monaco.editor.getModel).mockReturnValueOnce(
          monaco.latestModel,
        );
        editor.setValue(content);
        vi.waitUntil(() => editorMosaic.isEdited === true);

        // now call set again, same filename and SAME content
        await editorMosaic.set({ [id]: content });
        expect(editorMosaic.isEdited).toBe(false);

        // test that the editor still responds to edits
        content = '// fourth content';
        vi.mocked(monaco.editor.getModel).mockReturnValueOnce(
          monaco.latestModel,
        );
        editor.setValue(content);
        vi.waitUntil(() => editorMosaic.isEdited === true);
      });

      it('but not when the new file should be hidden', async () => {
        // set up a fully populated mosaic with visible files
        await editorMosaic.set(valuesIn);
        for (const [id, presence] of editorMosaic.files) {
          if (presence === EditorPresence.Pending) {
            await editorMosaic.addEditor(
              id,
              new MonacoEditorMock() as unknown as Editor,
            );
          }
        }

        // now replace with one visible file and one hidden file
        const keys = Object.keys(valuesIn);
        const [id1, id2] = keys;
        const values = { [id1]: '// potrzebie', [id2]: '' };
        await editorMosaic.set(values);

        // test that id1 got recycled but id2 is hidden
        const { files } = editorMosaic;
        expect(files.size).toBe(2);
        expect(files.get(id1 as EditorId)).toBe(EditorPresence.Visible);
        expect(files.get(id2 as EditorId)).toBe(EditorPresence.Hidden);
      });
    });

    it('does not add unrequested files', async () => {
      await editorMosaic.set(valuesIn);
      for (const key of editorMosaic.files.keys()) {
        expect(valuesIn).toHaveProperty([key]);
      }
    });

    describe('does not remember files from previous calls', () => {
      const id = MAIN_JS;

      afterEach(async () => {
        // this is the real test.
        // the three it()s below each set a different test condition
        await editorMosaic.set({});
        expect(editorMosaic.files.has(id)).toBe(false);
        expect(editorMosaic.value(id)).toBe('');
      });

      it('even if the file was visible', async () => {
        const content = '// fnord';
        await editorMosaic.set({ [id]: content });
        await editorMosaic.addEditor(id, editor);
        expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);
      });

      it('even if the file was hidden', async () => {
        const content = '';
        await editorMosaic.set({ [id]: content });
        expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);
      });

      it('even if the file was pending', async () => {
        const content = '// fnord';
        await editorMosaic.set({ [id]: content });
        expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);
      });
    });

    it('uses the expected layout', async () => {
      await editorMosaic.set(valuesIn);
      expect(editorMosaic.mosaic).toStrictEqual({
        direction: 'row',
        first: {
          direction: 'column',
          first: MAIN_JS,
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

  describe('value()', () => {
    const id = MAIN_JS;
    const content = '// content';
    const emptyContent = getEmptyContent(id);

    it('returns values for files that are hidden', async () => {
      const value = emptyContent;
      await editorMosaic.set({ [id]: value });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Hidden);

      expect(editorMosaic.value(id)).toBe(value);
    });

    it('returns values for files that are pending', async () => {
      const value = content;
      await editorMosaic.set({ [id]: value });
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Pending);

      expect(editorMosaic.value(id)).toBe(value);
    });

    it('returns values for files that are visible', async () => {
      const value = content;
      await editorMosaic.set({ [id]: value });
      await editorMosaic.addEditor(id, editor);
      expect(editorMosaic.files.get(id)).toBe(EditorPresence.Visible);

      expect(editorMosaic.value(id)).toBe(value);
    });

    it('returns an empty string if the editor does not exist', () => {
      expect(editorMosaic.value('unknown.js')).toBe('');
    });
  });

  describe('getFocusedEditor', () => {
    it('finds the focused editor if there is one', async () => {
      const id = MAIN_JS;
      await editorMosaic.set(valuesIn);
      await editorMosaic.addEditor(id, editor);
      vi.mocked(editor.hasTextFocus).mockReturnValue(true);

      expect(editorMosaic.getFocusedEditor()).toBe(editor);
    });

    it('returns undefined if none have focus', async () => {
      await editorMosaic.set(valuesIn);
      expect(editorMosaic.getFocusedEditor()).toBeUndefined();
    });
  });

  describe('layout', () => {
    it('layout() calls editor.layout() only once', async () => {
      const id = MAIN_JS;
      const content = '// content';
      const editor = new MonacoEditorMock() as unknown as Editor;
      await editorMosaic.set({ [id]: content });
      await editorMosaic.addEditor(id, editor);

      editorMosaic.layout();
      editorMosaic.layout();
      editorMosaic.layout();
      editorMosaic.layout();
      await vi.waitUntil(() => vi.mocked(editor.layout).mock.calls.length > 0);

      expect(editor.layout).toHaveBeenCalledTimes(1);
    });
  });

  describe('disposeLayoutAutorun()', () => {
    it('automatically updates the layout when the mosaic arrangement changes', () => {
      const spy = vi.spyOn(editorMosaic, 'layout');
      editorMosaic.mosaic = MAIN_JS;
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('isEdited', () => {
    const id = MAIN_JS;
    let editor: Editor;

    beforeEach(async () => {
      editor = new MonacoEditorMock() as unknown as Editor;
      await editorMosaic.set(valuesIn);
      await editorMosaic.addEditor(id, editor);
      expect(editorMosaic.isEdited).toBe(false);
    });

    it('recognizes edits', async () => {
      await editorMosaic.markAsSaved();
      expect(editorMosaic.isEdited).toBe(false);

      editor.setValue(`${editor.getValue()} more text`);

      // hashes are calculated asynchronously
      await vi.waitUntil(() => editorMosaic.isEdited === true);
    });
  });

  describe('setSeverityLevels', () => {
    it.each([
      {
        markers: [
          {
            severity: window.monaco.MarkerSeverity.Error,
            message: 'Error message',
          },
          {
            severity: window.monaco.MarkerSeverity.Warning,
            message: 'Warning message',
          },
        ],
        expectedSeverity: window.monaco.MarkerSeverity.Error,
      },
      {
        markers: [
          {
            severity: window.monaco.MarkerSeverity.Warning,
            message: 'Warning message',
          },
        ],
        expectedSeverity: window.monaco.MarkerSeverity.Warning,
      },
      {
        markers: [],
        expectedSeverity: window.monaco.MarkerSeverity.Hint,
      },
    ])(
      'updates severity levels based on Monaco markers',
      ({ markers, expectedSeverity }) => {
        const id = MAIN_JS;
        const editor = new MonacoEditorMock() as unknown as Editor;
        editorMosaic.set({ [id]: '// content' });
        editorMosaic.addEditor(id, editor);

        vi.mocked(monaco.editor.getModelMarkers).mockReturnValueOnce(
          markers as any,
        );

        editorMosaic.setSeverityLevels();

        const severityLevels = editorMosaic.editorSeverityMap;
        expect(severityLevels.get(id)).toBe(expectedSeverity);
      },
    );
  });
});
