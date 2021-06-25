import { mount, shallow } from 'enzyme';
import * as React from 'react';

import * as content from '../../../src/renderer/content';
import {
  DefaultEditorId,
  EditorValues,
  MAIN_JS,
} from '../../../src/interfaces';
import { Editors } from '../../../src/renderer/components/editors';
import { IpcEvents } from '../../../src/ipc-events';
import { EditorMosaic } from '../../../src/renderer/editor-mosaic';
import { ipcRendererManager } from '../../../src/renderer/ipc';

import {
  AppMock,
  MonacoEditorMock,
  StateMock,
  createEditorValues,
} from '../../mocks/mocks';

jest.mock('monaco-loader', () =>
  jest.fn(async () => {
    return { monaco: true };
  }),
);

jest.mock('../../../src/renderer/components/editor', () => ({
  Editor: () => 'Editor',
}));

describe('Editors component', () => {
  let app: AppMock;
  let monaco: any;
  let store: StateMock;
  let editorMosaic: EditorMosaic;
  let editorValues: EditorValues;

  beforeEach(() => {
    ({ app, monaco } = (window as any).ElectronFiddle);
    ({ state: store } = app);
    editorValues = createEditorValues();
    editorMosaic = new EditorMosaic();
    editorMosaic.set(editorValues);

    store.editorMosaic = editorMosaic as any;
  });

  it('renders', () => {
    const wrapper = mount(<Editors appState={store as any} />);
    wrapper.setState({ monaco });
    expect(wrapper).toMatchSnapshot();
  });

  it('does not execute command if not supported', () => {
    const wrapper = shallow(<Editors appState={store as any} />);
    const instance: Editors = wrapper.instance() as any;

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
    const filename = DefaultEditorId.html;

    it('handles an error', () => {
      const editor = new MonacoEditorMock();
      editorMosaic.addEditor(filename, editor as any);
      editor.updateOptions.mockImplementationOnce(() => {
        throw new Error('Bwap bwap');
      });

      const wrapper = shallow(<Editors appState={store as any} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
    });

    it('updates a setting', () => {
      const wrapper = shallow(<Editors appState={store as any} />);
      const instance: Editors = wrapper.instance() as any;

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
    const wrapper = shallow(<Editors appState={store as any} />);
    const instance: Editors = wrapper.instance() as any;
    const toolbar = instance.renderToolbar(
      { title: DefaultEditorId.main } as any,
      DefaultEditorId.main,
    );

    expect(toolbar).toMatchSnapshot();
  });

  it('does not render toolbar controls if only one editor exists', () => {
    const id = MAIN_JS;
    editorMosaic.set({ [id]: '// content' });

    const wrapper = shallow(<Editors appState={store as any} />);
    const instance: Editors = wrapper.instance() as any;
    const toolbar = instance.renderToolbar({ title: id } as any, id);
    expect(toolbar).toMatchSnapshot();
  });

  it('onChange() updates the mosaic arrangement in the appState', () => {
    const wrapper = shallow(<Editors appState={store as any} />);
    const instance: Editors = wrapper.instance() as any;

    const arrangement = { testArrangement: true };
    instance.onChange(arrangement as any);
    expect(editorMosaic.mosaic).toStrictEqual(arrangement);
  });

  describe('IPC commands', () => {
    it('handles a MONACO_EXECUTE_COMMAND command', () => {
      shallow(<Editors appState={store as any} />);

      const editor = new MonacoEditorMock();
      const action = editor.getAction();
      action.isSupported.mockReturnValue(true);

      editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

      ipcRendererManager.emit(IpcEvents.MONACO_EXECUTE_COMMAND, null, 'hello');
      expect(editor.getAction).toHaveBeenCalled();
      expect(action.isSupported).toHaveBeenCalled();
      expect(action.run).toHaveBeenCalled();
    });

    const fakeValues = {
      [DefaultEditorId.css]: '',
      [DefaultEditorId.html]: '',
      [DefaultEditorId.main]: 'hi',
      [DefaultEditorId.preload]: '',
      [DefaultEditorId.renderer]: '',
    } as const;

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
        shallow(<Editors appState={store as any} />);

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
        shallow(<Editors appState={store as any} />);

        const editor = new MonacoEditorMock();
        delete (editor as any).model;
        editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);

        await process.nextTick;
        expect(editor.getModel).toHaveBeenCalledTimes(1);
        expect(editor.setSelection).not.toHaveBeenCalled();
      });

      it('does not crash if there is no selected editor', () => {
        shallow(<Editors appState={store as any} />);
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
      shallow(<Editors appState={store as any} />);

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

      shallow(<Editors appState={store as any} />);
      ipcRendererManager.emit(IpcEvents.MONACO_TOGGLE_OPTION, null, 'wordWrap');
      expect(editor.updateOptions).toHaveBeenCalled();
    });
  });

  describe('setFocused()', () => {
    it('sets the "focused" property', () => {
      const wrapper = shallow(<Editors appState={store as any} />);
      const instance: Editors = wrapper.instance() as any;
      const spy = jest.spyOn(instance, 'setState');

      const id = DefaultEditorId.html;
      instance.setFocused(id);
      expect(spy).toHaveBeenCalledWith({ focused: id });
    });
  });
});
