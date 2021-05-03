import {
  DEFAULT_EDITORS,
  DefaultEditorId,
  EditorId,
  EditorValues,
} from '../../src/interfaces';
import { EditorBackup, EditorMosaic } from '../../src/renderer/editor-mosaic';
import {
  DEFAULT_MOSAIC_ARRANGEMENT,
  SORTED_EDITORS,
} from '../../src/renderer/constants';
import { compareEditors } from '../../src/utils/editor-utils';
import { createMosaicArrangement } from '../../src/utils/editors-mosaic-arrangement';
import { MonacoEditorMock, createEditorValues } from '../mocks/mocks';
import { waitForEditorsToMount } from '../../src/utils/editor-mounted';

jest.mock('../../src/utils/editor-mounted', () => ({
  waitForEditorsToMount: jest.fn(),
}));

describe('EditorMosaic', () => {
  let editorMosaic: EditorMosaic;

  beforeEach(() => {
    // inject a real EditorMosaic into our mock scaffolding
    editorMosaic = new EditorMosaic();
    (window as any).ElectronFiddle.app.state.editorMosaic = editorMosaic;
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
    it('updates the visible editors and creates a backup', async () => {
      editorMosaic.mosaicArrangement = createMosaicArrangement(DEFAULT_EDITORS);
      editorMosaic.closedPanels = {};
      editorMosaic.customMosaics = [];
      await editorMosaic.setVisibleMosaics([DefaultEditorId.main]);

      // we just need to mock something truthy here
      editorMosaic.editors.set(DefaultEditorId.main, {} as any);

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
      expect(editorMosaic.closedPanels[DefaultEditorId.main]).toBeTruthy();
      expect(
        editorMosaic.closedPanels[DefaultEditorId.renderer],
      ).toBeUndefined();
      expect(editorMosaic.closedPanels[DefaultEditorId.html]).toBeUndefined();
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
    it('gets values', async () => {
      (waitForEditorsToMount as jest.Mock).mockResolvedValue(true);
      const values = createEditorValues();
      await editorMosaic.set(values);
      expect(editorMosaic.values()).toStrictEqual(values);
    });
  });

  describe('set()', () => {
    it('only shows non-empty files', async () => {
      const spy = jest.spyOn(editorMosaic, 'setVisibleMosaics');

      const values = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.css]: '/* Empty */',
        [DefaultEditorId.preload]: '',
      } as const;

      await editorMosaic.set(values);
      expect(spy).toHaveBeenCalledWith([
        DefaultEditorId.main,
        DefaultEditorId.renderer,
        DefaultEditorId.html,
      ]);

      spy.mockRestore();
    });

    it('shows visible mosaics for non-empty editor contents with custom mosaics', async () => {
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

      await editorMosaic.set(values);
      expect(spy).toHaveBeenCalledWith([
        DefaultEditorId.main,
        DefaultEditorId.renderer,
        DefaultEditorId.html,
        file,
      ]);

      spy.mockRestore();
    });

    it('sorts the mosaics', async () => {
      const spy = jest.spyOn(editorMosaic, 'setVisibleMosaics');

      // this order is defined inside the replaceFiddle() function
      const values = createEditorValues();
      await editorMosaic.set(values);
      const expected = Object.keys(values).sort(compareEditors);
      expect(spy).toHaveBeenCalledWith(expected);

      spy.mockRestore();
    });

    it('attempts to set values', async () => {
      const values: EditorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
      } as const;
      for (const filename of Object.keys(values)) {
        editorMosaic.editors.set(
          filename as EditorId,
          new MonacoEditorMock() as any,
        );
      }
      await editorMosaic.set(values);

      for (const [filename, value] of Object.entries(values)) {
        const editor = editorMosaic.editors.get(filename as EditorId);
        expect(editor!.setValue).toHaveBeenCalledWith(value);
      }
    });

    it('attempts to set values for closed editors', async () => {
      editorMosaic.editors.delete(DefaultEditorId.main);

      (editorMosaic.closedPanels as any)[DefaultEditorId.main] = {
        model: { setValue: jest.fn() },
      };
      editorMosaic.closedPanels[DefaultEditorId.preload] = {};
      editorMosaic.closedPanels[DefaultEditorId.css] = {};

      await editorMosaic.set({
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.preload]: 'preload-value',
        [DefaultEditorId.css]: 'css-value',
      });

      expect(
        (editorMosaic.closedPanels[DefaultEditorId.main] as EditorBackup)!
          .model!.setValue,
      ).toHaveBeenCalledWith('main-value');
      expect(editorMosaic.closedPanels[DefaultEditorId.preload]).toEqual({
        value: 'preload-value',
      });
      expect(editorMosaic.closedPanels[DefaultEditorId.css]).toEqual({
        value: 'css-value',
      });
    });

    it('does not set a value if none passed in', async () => {
      const id = DefaultEditorId.renderer;
      const oldValue = editorMosaic.getEditorValue(id);

      await editorMosaic.set({
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
      });

      expect(editorMosaic.getEditorValue(id)).toBe(oldValue);
    });
  });

  describe('getEditorValue()', () => {
    const filename = DefaultEditorId.html;
    const value = 'editor-value';

    beforeEach(() => {
      const editor = new MonacoEditorMock();
      editor.getValue.mockReturnValue(value);
      editorMosaic.editors.set(filename, editor as any);
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
      editorMosaic.editors.set(filename, editor as any);
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
      editorMosaic.editors.set(filename, editor as any);

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
      editorMosaic.editors.set(filename, editor as any);

      expect(editorMosaic.getEditorModel(filename)).toBe(model);
    });

    it('returns null if the editor does not exist', () => {
      editorMosaic.editors.delete(filename);
      expect(editorMosaic.getEditorModel(filename)).toBeNull();
    });
  });

  describe('editor-layout', () => {
    it('layout() calls editor.layout() only once', (done) => {
      editorMosaic.layout();
      editorMosaic.layout();
      editorMosaic.layout();
      editorMosaic.layout();

      setTimeout(() => {
        for (const editor of editorMosaic.editors.values()) {
          expect(editor.layout).toHaveBeenCalledTimes(1);
        }
        done();
      }, 100);
    });
  });
});
