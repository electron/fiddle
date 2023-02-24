import * as React from 'react';

import { mount, shallow } from 'enzyme';

import { EditorValues, MAIN_JS } from '../../../src/interfaces';
import { IpcEvents } from '../../../src/ipc-events';
import { App } from '../../../src/renderer/app';
import { Editors } from '../../../src/renderer/components/editors';
import * as content from '../../../src/renderer/content';
import { EditorMosaic } from '../../../src/renderer/editor-mosaic';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { AppState } from '../../../src/renderer/state';
import {
  MonacoEditorMock,
  MonacoMock,
  StateMock,
  createEditorValues,
} from '../../mocks/mocks';

jest.mock('../../../src/renderer/components/editor', () => ({
  Editor: () => 'Editor',
}));

describe('Editors component', () => {
  let app: App;
  let monaco: MonacoMock;
  let store: AppState;
  let editorMosaic: EditorMosaic;
  let editorValues: EditorValues;

  beforeEach(() => {
    ({ app } = window.ElectronFiddle);
    monaco = (window.ElectronFiddle.monaco as unknown) as MonacoMock;
    ({ state: store } = window.ElectronFiddle.app);
    editorValues = createEditorValues();
    editorMosaic = new EditorMosaic();
    editorMosaic.set(editorValues);

    ((store as unknown) as StateMock).editorMosaic = editorMosaic;
  });

  it('renders', () => {
    const wrapper = mount(<Editors appState={store} />);
    wrapper.setState({ monaco });
    expect(wrapper).toMatchSnapshot();
  });

  it('does not execute command if not supported', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: any = wrapper.instance() as any;

    const editor = new MonacoEditorMock();
    const action = editor.getAction();
    action.isSupported.mockReturnValue(false);

    editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

    instance.executeCommand('hello');
    expect(editor.getAction).toHaveBeenCalled();
    expect(action.isSupported).toHaveBeenCalled();
    expect(action.run).toHaveBeenCalledTimes(0);
  });

  describe('toggleEditorOption()', () => {
    const filename = MAIN_JS;

    it('handles an error', () => {
      const editor = new MonacoEditorMock();
      editorMosaic.addEditor(filename, editor as any);
      editor.updateOptions.mockImplementationOnce(() => {
        throw new Error('Bwap bwap');
      });

      const wrapper = shallow(<Editors appState={store} />);
      const instance: any = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
    });

    it('updates a setting', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: any = wrapper.instance() as any;

      const editor = new MonacoEditorMock();
      editorMosaic.addEditor(filename, editor as any);
      expect(instance.toggleEditorOption('wordWrap')).toBe(true);
      expect(editor.updateOptions).toHaveBeenCalledWith({
        minimap: { enabled: false },
        wordWrap: 'off',
      });
    });
  });

  it('renders a toolbar', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: any = wrapper.instance() as any;
    const toolbar = instance.renderToolbar({ title: MAIN_JS } as any, MAIN_JS);

    expect(toolbar).toMatchSnapshot();
  });

  it('onChange() updates the mosaic arrangement in the appState', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: any = wrapper.instance() as any;

    const arrangement = { testArrangement: true };
    instance.onChange(arrangement as any);
    expect(editorMosaic.mosaic).toStrictEqual(arrangement);
  });

  describe('IPC commands', () => {
    it('handles a MONACO_EXECUTE_COMMAND command', () => {
      shallow(<Editors appState={store} />);

      const editor = new MonacoEditorMock();
      const action = editor.getAction();
      action.isSupported.mockReturnValue(true);

      editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

      ipcRendererManager.emit(IpcEvents.MONACO_EXECUTE_COMMAND, null, 'hello');
      expect(editor.getAction).toHaveBeenCalled();
      expect(action.isSupported).toHaveBeenCalled();
      expect(action.run).toHaveBeenCalled();
    });

    const fakeValues = { [MAIN_JS]: 'hi' } as const;

    it('handles an FS_NEW_FIDDLE command', async () => {
      let resolve: any;
      const replacePromise = new Promise((r) => {
        resolve = r;
      });

      // setup
      const getTemplateSpy = jest
        .spyOn(content, 'getTemplate')
        .mockImplementation(() => Promise.resolve(fakeValues));
      const replaceFiddleSpy = jest
        .spyOn(app, 'replaceFiddle')
        .mockImplementation(() => resolve());

      // invoke the call
      ipcRendererManager.emit(IpcEvents.FS_NEW_FIDDLE, null);
      await replacePromise;

      // check the results
      expect(getTemplateSpy).toHaveBeenCalledTimes(1);
      expect(replaceFiddleSpy).toHaveBeenCalledTimes(1);

      // cleanup
      getTemplateSpy.mockRestore();
      replaceFiddleSpy.mockRestore();
    });

    describe('SELECT_ALL_IN_EDITOR handler', () => {
      it('selects all in the focused editor', async () => {
        shallow(<Editors appState={store} />);

        const range = 'range';
        const editor = new MonacoEditorMock();
        const model = editor.getModel();
        model.getFullModelRange.mockReturnValue(range);
        editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);

        await process.nextTick;
        expect(editor.setSelection).toHaveBeenCalledWith('range');
      });

      it('does not change selection if the selected editor has no model', async () => {
        shallow(<Editors appState={store} />);

        const editor = new MonacoEditorMock();
        delete (editor as any).model;
        editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);

        await process.nextTick;
        expect(editor.getModel).toHaveBeenCalledTimes(1);
        expect(editor.setSelection).not.toHaveBeenCalled();
      });

      it('does not crash if there is no selected editor', () => {
        shallow(<Editors appState={store} />);
        editorMosaic.focusedEditor = jest.fn().mockReturnValue(null);
        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);
      });
    });

    it('handles an FS_NEW_TEST command', async () => {
      // setup
      const getTestTemplateSpy = jest
        .spyOn(content, 'getTestTemplate')
        .mockImplementation(() => Promise.resolve(fakeValues));
      let replaceResolve: any;
      const replacePromise = new Promise((r) => {
        replaceResolve = r;
      });
      const replaceFiddleSpy = jest
        .spyOn(app, 'replaceFiddle')
        .mockImplementation(() => replaceResolve());

      // invoke the call
      ipcRendererManager.emit(IpcEvents.FS_NEW_TEST);
      await replacePromise;

      // check the results
      expect(getTestTemplateSpy).toHaveBeenCalled();
      expect(replaceFiddleSpy).toHaveBeenCalled();

      // cleanup
      getTestTemplateSpy.mockRestore();
      replaceFiddleSpy.mockRestore();
    });
    it('handles a SELECT_ALL_IN_EDITOR command', async () => {
      shallow(<Editors appState={store} />);

      const range = 'range';
      const editor = new MonacoEditorMock();
      editor.getModel().getFullModelRange.mockReturnValue(range);
      editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

      ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);
      await process.nextTick;

      expect(editor.setSelection).toHaveBeenCalledWith(range);
    });

    it('handles the monaco editor option commands', () => {
      const id = MAIN_JS;
      const editor = new MonacoEditorMock();
      editorMosaic.addEditor(id, editor as any);

      shallow(<Editors appState={store} />);
      ipcRendererManager.emit(IpcEvents.MONACO_TOGGLE_OPTION, null, 'wordWrap');
      expect(editor.updateOptions).toHaveBeenCalled();
    });
  });

  describe('setFocused()', () => {
    it('sets the "focused" property', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: any = wrapper.instance() as any;
      const spy = jest.spyOn(instance, 'setState');

      const id = MAIN_JS;
      instance.setFocused(id);
      expect(spy).toHaveBeenCalledWith({ focused: id });
    });

    it('focus sidebar file', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: any = wrapper.instance() as any;
      const spy = jest.spyOn(instance, 'setState');

      const id = MAIN_JS;
      instance.setFocused(id);
      expect(spy).toHaveBeenCalledWith({ focused: id });
      expect(instance.props.appState.editorMosaic.focusedFile).toBe(id);
    });
  });
});
