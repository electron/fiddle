// import { observable } from 'mobx';
import * as React from 'react';
import { mount, shallow } from 'enzyme';

import * as content from '../../../src/renderer/content';
import { IpcEvents } from '../../../src/ipc-events';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { EditorMosaic } from '../../../src/renderer/editor-mosaic';
import { EditorValues, MAIN_JS } from '../../../src/interfaces';
import { Editors } from '../../../src/renderer/components/editors';
import { getEditorTitle } from '../../../src/utils/editor-utils';

import { MonacoEditorMock } from '../../mocks/monaco-editor';
import { AppMock } from '../../mocks/app';
import { createEditorValues } from '../../mocks/editor-values';

jest.mock('monaco-loader', () =>
  jest.fn(async () => {
    return { monaco: true };
  }),
);

jest.mock('../../../src/renderer/components/editor', () => ({
  Editor: () => 'Editor',
}));

describe('Editors component', () => {
  let store: any;
  let app: AppMock;
  let editor: MonacoEditorMock;
  let editorValues: EditorValues;
  let editorMosaic: EditorMosaic;

  beforeEach(() => {
    store = {
      isSettingsShowing: false,
      isTokenDialogShowing: false,
      setGenericDialogOptions: () => ({}),
    };

    app = new AppMock();
    (window as any).ElectronFiddle.app = app;
    editor = new MonacoEditorMock();
    editorValues = createEditorValues();
    editorValues['styles.css'] = '/* styles.css */';
    editorMosaic = new EditorMosaic(app as any);
  });

  function createEditorsComponent() {
    const wrapper = shallow(
      <Editors appState={store} editorMosaic={editorMosaic} />,
    );
    const instance: Editors = wrapper.instance() as any;
    return { instance, wrapper };
  }

  function createMountedEditorsComponent() {
    const wrapper = mount(
      <Editors appState={store} editorMosaic={editorMosaic} />,
    );
    const instance: Editors = wrapper.instance() as any;
    return { instance, wrapper };
  }

  it('renders', () => {
    editorMosaic.set(editorValues);
    console.log(
      JSON.stringify(editorMosaic.inspect()),
      JSON.stringify(editorMosaic.mosaic),
    );
    const { wrapper } = createMountedEditorsComponent();
    wrapper.setState({ monaco: app.monaco });
    expect(wrapper).toMatchSnapshot();
  });

  it('does not execute command if not supported', () => {
    const { instance } = createEditorsComponent();

    // spin up a live mosaic
    editorMosaic.set(editorValues);

    // inject a mock focused editor that does not support the action
    editor.hasTextFocus.mockReturnValue(true);
    editor.getAction().isSupported.mockReturnValue(false);
    editorMosaic.addEditor(MAIN_JS, editor as any);

    instance.executeCommand('hello');

    expect(editor.getAction).toHaveBeenCalled();
    expect(editor.getAction().isSupported).toHaveBeenCalled();
    expect(editor.getAction().run).not.toHaveBeenCalled();
  });

  describe('toggleEditorOption()', () => {
    const option = 'wordWrap';

    it('handles an error', () => {
      editor.updateOptions.mockImplementationOnce(() => {
        throw new Error('💩');
      });
      editorMosaic.set(editorValues);
      editorMosaic.addEditor(MAIN_JS, editor as any);
      const { instance } = createEditorsComponent();
      expect(instance.toggleEditorOption(option)).toBe(false);
    });

    it('updates a setting', () => {
      editorMosaic.set(editorValues);
      editorMosaic.addEditor(MAIN_JS, editor as any);
      const { instance } = createEditorsComponent();
      expect(instance.toggleEditorOption(option)).toBe(true);
      expect(editor.updateOptions).toHaveBeenCalledWith({
        minimap: { enabled: false },
        wordWrap: 'off',
      });
    });
  });

  it('renders a toolbar', () => {
    const { instance } = createEditorsComponent();
    const toolbar = instance.renderToolbar(
      { title: getEditorTitle(MAIN_JS) } as any,
      MAIN_JS,
    );
    expect(toolbar).toMatchSnapshot();
  });

  it('does not render toolbar controls if only one editor exists', () => {
    // set up a real single-file mosaic with a mock editor
    const filename = MAIN_JS;
    editorMosaic.set({ [filename]: '// hello world' });
    editorMosaic.addEditor(filename, editor as any);

    const { instance } = createEditorsComponent();
    const toolbar = instance.renderToolbar(
      { title: getEditorTitle(MAIN_JS) } as any,
      MAIN_JS,
    );
    expect(toolbar).toMatchSnapshot();
  });

  describe('IPC commands', () => {
    it('handles a MONACO_EXECUTE_COMMAND command', () => {
      createEditorsComponent();

      editorMosaic.set(editorValues);
      editorMosaic.addEditor(MAIN_JS, editor as any);

      // oo! oo! run the action on ME!
      editor.getAction().isSupported.mockReturnValue(true);
      editor.hasTextFocus.mockReturnValue(true);

      ipcRendererManager.emit(IpcEvents.MONACO_EXECUTE_COMMAND, null, 'hello');
      expect(editor.getAction).toHaveBeenCalled();
      expect(editor.getAction().isSupported).toHaveBeenCalled();
      expect(editor.getAction().run).toHaveBeenCalled();
    });

    describe('SELECT_ALL_IN_EDITOR handler', () => {
      it('selects all in the focused editor', (done) => {
        const modelRange = 'range';
        createEditorsComponent();

        editorMosaic.set(editorValues);
        editor.setModel = jest.fn();
        editor.getModel().getFullModelRange.mockReturnValue(modelRange);
        editorMosaic.addEditor(MAIN_JS, editor as any);
        editor.hasTextFocus.mockReturnValue(true);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);

        process.nextTick(() => {
          expect(editor.setSelection).toHaveBeenCalledWith(modelRange);
          done();
        });
      });

      it('does not change selection if the selected editor has no model', (done) => {
        createEditorsComponent();

        editorMosaic.set(editorValues);
        editorMosaic.addEditor(MAIN_JS, editor as any);

        editor.getModel.mockReturnValue(null);
        editor.hasTextFocus.mockReturnValue(true);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);

        process.nextTick(() => {
          expect(editor.getModel).toHaveBeenCalledTimes(1);
          expect(editor.setSelection).not.toHaveBeenCalled();
          done();
        });
      });

      it('does not crash if there is no selected editor', () => {
        createEditorsComponent();

        editorMosaic.set(editorValues);
        editorMosaic.addEditor(MAIN_JS, editor as any);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);
      });
    });

    async function handlesAnFsNewCommand(methodName: string, event: IpcEvents) {
      createEditorsComponent();

      let resolve: any;
      const replacePromise = new Promise((r) => {
        resolve = r;
      });

      // setup
      const templateSpy = jest
        .spyOn(content, methodName as any)
        .mockImplementation(() => Promise.resolve(editorValues));
      const replaceSpy = jest
        .spyOn(app, 'replaceFiddle')
        .mockImplementation(() => resolve());

      // invoke the call
      ipcRendererManager.emit(event, null);
      await replacePromise;

      // check the results
      expect(templateSpy).toHaveBeenCalledTimes(1);
      expect(replaceSpy).toHaveBeenCalledTimes(1);

      // cleanup
      templateSpy.mockRestore();
      replaceSpy.mockRestore();
    }

    it('handles an FS_NEW_FIDDLE commandddd', async () => {
      handlesAnFsNewCommand('getTemplate', IpcEvents.FS_NEW_FIDDLE);
    });
    it('handles an FS_NEW_TEST commandddd', async () => {
      handlesAnFsNewCommand('getTestTemplate', IpcEvents.FS_NEW_TEST);
    });

    it('handles the monaco editor option commands', () => {
      createEditorsComponent();

      editorMosaic.set(editorValues);
      editorMosaic.addEditor(MAIN_JS, editor as any);

      ipcRendererManager.emit(IpcEvents.MONACO_TOGGLE_OPTION, null, 'wordWrap');

      expect(editor.updateOptions).toHaveBeenCalled();
    });
  });

  describe('loadMonaco()', () => {
    it('loads Monaco', (done) => {
      (window as any).ElectronFiddle.app.monaco = null;

      createEditorsComponent();

      process.nextTick(() => {
        expect(app.monaco).toEqual({ monaco: true });
        done();
      });
    });
  });

  describe('setFocused()', () => {
    it('sets the "focused" property', () => {
      const filename = MAIN_JS;
      editorMosaic.set(editorValues);
      editorMosaic.addEditor(filename, editor as any);
      const { instance } = createEditorsComponent();
      const spy = jest.spyOn(instance, 'setState');
      instance.setFocused(filename);
      expect(spy).toHaveBeenCalledWith({ focused: filename });
    });
  });
});
