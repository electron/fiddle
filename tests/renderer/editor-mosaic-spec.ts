import { App } from '../../src/renderer/app';
import { AppMock } from '../mocks/app';
import { EditorId, EditorValues, MAIN_JS } from '../../src/interfaces';
import { EditorMosaic, EditorState } from '../../src/renderer/editor-mosaic';
import { MonacoEditorMock } from '../mocks/monaco-editor';
import { getEmptyContent } from '../../src/utils/editor-utils';
import { toJS } from 'mobx';
import { waitFor } from '../../src/utils/wait-for';

describe('EditorMosaic', () => {
  let app: AppMock;
  let editorMosaic: EditorMosaic;
  let valuesIn: Partial<EditorValues>;
  let editor: MonacoEditorMock;
  const newFile = 'hello.js';
  const boringFile = 'boring.js';
  const unsupportedFile = 'wrong-suffix.java';

  function takeSnapshot(em: EditorMosaic) {
    return [
      JSON.stringify(toJS(em.states)),
      JSON.stringify(toJS(em.inspect())),
    ];
  }

  function expectSnapshotToMatch(em: EditorMosaic, snap: any) {
    expect(takeSnapshot(em)).toStrictEqual(snap);
  }

  function expectNoChange(em: EditorMosaic, func: any) {
    const snap = takeSnapshot(em);
    func();
    expectSnapshotToMatch(em, snap);
  }

  beforeEach(() => {
    app = new AppMock();
    editor = new MonacoEditorMock();
    editorMosaic = new EditorMosaic((app as any) as App);
    valuesIn = {
      'index.html': '// index.html',
      'preload.js': '// preload.js',
      'renderer.js': '// renderer.js',
      [MAIN_JS]: '// this is main',
      [boringFile]: '', // boring content; hidden by default
    };
  });

  describe('set', () => {
    it('adds the files to the editor mosaic', () => {
      editorMosaic.set(valuesIn);
      expect(editorMosaic.values()).toEqual(valuesIn);
    });

    it('removes the previous files', () => {
      editorMosaic.set(valuesIn);
      expect(editorMosaic.values()).toEqual(valuesIn);

      const fewerFiles = { ...valuesIn };
      Object.keys(fewerFiles).forEach((key, idx) => {
        if (idx % 2 === 0) delete fewerFiles[key];
      });
      editorMosaic.set(fewerFiles);
      expect(editorMosaic.values()).toEqual(fewerFiles);
    });

    it('resets isEdited to false', () => {
      editorMosaic.isEdited = true;
      editorMosaic.set(valuesIn);
      expect(editorMosaic.isEdited).toBe(false);
    });

    it('sets the values immediately if an editor is available', () => {
      editorMosaic.set(valuesIn);
    });

    it('hides boring files by default', () => {
      editorMosaic.set(valuesIn);
      expect(editorMosaic.states.get(boringFile)).toBe(EditorState.Hidden);
    });

    it('reuses editors when available', () => {
      const { ids } = editorMosaic.inspect();
      ids.set(MAIN_JS, { editor: editor as any });
      editorMosaic.set(valuesIn);
      expect(editor.setValue).toHaveBeenCalledTimes(1);
      expect(editor.setValue).toHaveBeenCalledWith<any>(valuesIn[MAIN_JS]);
      expect(editorMosaic.states.get(MAIN_JS)).toBe(EditorState.Visible);
    });
  });

  describe('add', () => {
    const content = '// this is a file';

    it('throws on duplicate files', () => {
      editorMosaic.set(valuesIn);
      expect(() => editorMosaic.add(MAIN_JS, content)).toThrow('duplicate');
    });

    it('throws on unsupported files', () => {
      const fn = () => editorMosaic.add(unsupportedFile as EditorId, content);
      expect(fn).toThrow();
    });

    it('adds the id to the mosaic', () => {
      editorMosaic.add(newFile, content);
      expect(editorMosaic.states.get(newFile)).toBe(EditorState.Pending);
    });

    it('handles null content', () => {
      editorMosaic.add(newFile, null as any);
      expect(editorMosaic.states.get(newFile)).toBe(EditorState.Pending);
      expect(editorMosaic.values()[newFile]).toBe('');
    });
  });

  describe('remove', () => {
    it('removes a file if present', () => {
      editorMosaic.set(valuesIn);
      editorMosaic.remove(MAIN_JS);
      expect(editorMosaic.values[MAIN_JS]).toBeUndefined();
    });

    it('does nothing if the file is not present', () => {
      editorMosaic.set(valuesIn);
      expectNoChange(editorMosaic, () => editorMosaic.remove(newFile));
    });
  });

  describe('inspect', () => {
    it('is inaccessible in production', () => {
      const { JEST_WORKER_ID } = process.env;
      delete process.env.JEST_WORKER_ID;
      expect(() => editorMosaic.inspect()).toThrow();
      process.env.JEST_WORKER_ID = JEST_WORKER_ID;
    });
  });

  describe('resetLayout', () => {
    it('leaves isEdited unchanged', () => {
      editorMosaic.set(valuesIn);
      const { isEdited } = editorMosaic;
      editorMosaic.resetLayout();
      expect(editorMosaic.isEdited).toStrictEqual(isEdited);
    });

    it('leaves files unchanged', () => {
      editorMosaic.set(valuesIn);
      const filenames = Object.keys(editorMosaic.states);
      editorMosaic.resetLayout();
      expect(Object.keys(editorMosaic.states)).toEqual(filenames);
    });

    it('resets layout to original state', () => {
      editorMosaic.set(valuesIn);
      expectNoChange(editorMosaic, () => {
        editorMosaic.hide(MAIN_JS);
        editorMosaic.resetLayout();
      });
    });
  });

  describe('hide', () => {
    it('hides a file if visible', () => {
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(MAIN_JS, editor as any);
      expect(editorMosaic.states.get(MAIN_JS)).toBe(EditorState.Visible);
      editorMosaic.hide(MAIN_JS);
      expect(editorMosaic.states.get(MAIN_JS)).toBe(EditorState.Hidden);
    });

    it('does nothing if file is unknown', () => {
      editorMosaic.set(valuesIn);
      expectNoChange(editorMosaic, () => editorMosaic.hide(newFile));
    });

    it('does nothing if file is hidden', () => {
      const filename = boringFile;
      editorMosaic.set(valuesIn);
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Hidden);
      expectNoChange(editorMosaic, () => editorMosaic.hide(MAIN_JS));
    });
  });

  describe('show', () => {
    describe('restores a hidden file', () => {
      it('and includes the viewState if it exists', () => {
        const filename = MAIN_JS;
        const viewState = 'this is a fake viewstate';
        editor.saveViewState.mockReturnValue(viewState);

        // set up a file that's initially visible...
        editorMosaic.set(valuesIn);
        editorMosaic.addEditor(filename, editor as any);

        // hide it; should use the viewState
        editorMosaic.hide(filename);
        expect(editor.saveViewState).toHaveBeenCalled();

        // show it; should restore the viewState
        editorMosaic.show(filename);
        editorMosaic.addEditor(filename, editor as any);
        expect(editor.restoreViewState).toHaveBeenCalledWith<any>(viewState);
      });

      it('and includes the model if it exists', () => {
        const filename = MAIN_JS;
        const fakeModel = 'this is a fake model';
        editor.getModel.mockReturnValue(fakeModel);

        // set up a file that's initially visible...
        editorMosaic.set(valuesIn);
        editorMosaic.addEditor(filename, editor as any);

        // hide it; should try to cache the model
        editorMosaic.hide(filename);
        expect(editor.getModel).toHaveBeenCalled();

        editorMosaic.show(filename);
        editorMosaic.addEditor(filename, editor as any);
        expect(editor.setModel).toHaveBeenCalledWith<any>(fakeModel);
      });

      it('from the initial value passed into set()', () => {
        const filename = boringFile;
        editorMosaic.set(valuesIn);
        expect(editorMosaic.states.get(filename)).toBe(EditorState.Hidden);
        editorMosaic.show(filename);
        expect(editorMosaic.states.get(filename)).not.toBe(EditorState.Hidden);
      });
    });

    it('does nothing if file is unknown', () => {
      editorMosaic.set(valuesIn);
      expectNoChange(editorMosaic, () => editorMosaic.show(newFile));
    });

    it('does nothing if file is already pending', () => {
      editorMosaic.set(valuesIn);
      expectNoChange(editorMosaic, () => editorMosaic.show(MAIN_JS));
    });

    it('does nothing if file is already visible', () => {
      const filename = MAIN_JS;
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(filename, editor as any);
      expectNoChange(editorMosaic, () => editorMosaic.show(filename));
    });
  });

  describe('toggle', () => {
    it('shows a file if possible', () => {
      const filename = boringFile;
      editorMosaic.set(valuesIn);
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Hidden);
      editorMosaic.toggle(filename);
      expect(editorMosaic.states.get(filename)).not.toBe(EditorState.Hidden);
    });

    it('hides a file if possible', () => {
      const filename = MAIN_JS;
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(filename, editor as any);
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Visible);
      editorMosaic.toggle(filename);
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Hidden);
    });

    it('does nothing if file is unknown', () => {
      expectNoChange(editorMosaic, () => editorMosaic.toggle(newFile));
    });
  });

  describe('showAll', () => {
    it('shows a file if hidden', () => {
      const filename = boringFile;
      editorMosaic.set(valuesIn);
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Hidden);
      editorMosaic.showAll();
      expect(editorMosaic.states.get(filename)).not.toBe(EditorState.Hidden);
    });

    it('leaves visible files visible', () => {
      const filename = MAIN_JS;
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(filename, editor as any);
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Visible);
      editorMosaic.showAll();
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Visible);
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
    it('eventually calls layout for all editors', async () => {
      const filename = MAIN_JS;
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(filename, editor as any);
      editorMosaic.layout();
      // it's debounced, so wait a moment
      await waitFor(() => editor.layout.mock.calls.length > 0);
      expect(editor.layout).toHaveBeenCalled();
    });
  });

  describe('values', () => {
    it('loads values for hidden files', () => {
      const filename = MAIN_JS;
      const content = getEmptyContent(filename);
      valuesIn[filename] = content;
      editorMosaic.set(valuesIn);
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Hidden);
      expect(editorMosaic.values()[filename]).toBe(content);
    });

    it('loads values for visible files', () => {
      const filename = MAIN_JS;
      const content = 'this is text typed in the editor';
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(filename, editor as any);
      editor.setValue(content);
      expect(editorMosaic.values()[filename]).toBe(content);
    });
  });

  describe('addEditor', () => {
    it('throws on unexpected files', () => {
      editorMosaic.set(valuesIn);
      expect(() => editorMosaic.addEditor(boringFile, editor as any)).toThrow();
      expect(() => editorMosaic.addEditor(newFile, editor as any)).toThrow();
    });
  });

  describe('updateOptions', () => {
    it('calls editor.updateOptions for all editors', () => {
      const filename = MAIN_JS;
      const options = { hello: 'world' };
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(filename, editor as any);
      editorMosaic.updateOptions(options as any);
      expect(editor.updateOptions).toHaveBeenCalledWith<any>(options);
    });
  });

  describe('isEdited', () => {
    it('is false after calling set()', () => {
      editorMosaic.set(valuesIn);
      expect(editorMosaic.isEdited).toBe(false);
    });

    it('reacts to content changing and being saved', () => {
      // load a fiddle...
      const filename = MAIN_JS;
      editorMosaic.set(valuesIn);
      editorMosaic.addEditor(filename, editor as any);
      expect(editorMosaic.isEdited).toBe(false);

      // user makes some changes...
      editor.setValue('this is the new value');
      expect(editorMosaic.isEdited).toBe(true);

      // user saves the changes...
      editorMosaic.isEdited = false;
      expect(editorMosaic.isEdited).toBe(false);

      // user makes some *more* changes...
      editor.setValue('this is the NEW new value');
      expect(editorMosaic.isEdited).toBe(true);
    });
  });

  describe('mosaicLeafCount', () => {
    it('returns the number of files in the mosaic', () => {
      expect(editorMosaic.mosaicLeafCount).toBe(0);
      editorMosaic.set(valuesIn);
      const interestingFileCount = Object.keys(valuesIn).length - 1;
      expect(editorMosaic.mosaicLeafCount).toBe(interestingFileCount);
    });
  });

  describe('values', () => {
    it('returns values when unchanged', () => {
      editorMosaic.set(valuesIn);
      expect(editorMosaic.values()).toStrictEqual(valuesIn);
    });
  });
});
