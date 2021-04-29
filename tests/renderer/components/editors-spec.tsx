import { mount, shallow } from 'enzyme';
import * as React from 'react';

import * as content from '../../../src/renderer/content';
import { DEFAULT_EDITORS, DefaultEditorId } from '../../../src/interfaces';
import { Editors } from '../../../src/renderer/components/editors';
import { IpcEvents } from '../../../src/ipc-events';
import { createMosaicArrangement } from '../../../src/utils/editors-mosaic-arrangement';
import { getFocusedEditor } from '../../../src/utils/focused-editor';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { updateEditorLayout } from '../../../src/utils/editor-layout';

import { MonacoEditorMock, StateMock } from '../../mocks/mocks';

jest.mock('monaco-loader', () =>
  jest.fn(async () => {
    return { monaco: true };
  }),
);

jest.mock('../../../src/renderer/components/editor', () => ({
  Editor: () => 'Editor',
}));

jest.mock('../../../src/utils/focused-editor', () => ({
  getFocusedEditor: jest.fn(),
}));

jest.mock('../../../src/utils/editor-layout', () => ({
  updateEditorLayout: jest.fn(),
}));

describe('Editors component', () => {
  let ElectronFiddle: any;
  let monaco: any;
  let store: StateMock;

  beforeEach(() => {
    ({ ElectronFiddle } = window as any);
    ({ monaco, state: store } = ElectronFiddle.app);
    store.mosaicArrangement = createMosaicArrangement(DEFAULT_EDITORS);
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

    (getFocusedEditor as any).mockReturnValueOnce(editor);

    instance.executeCommand('hello');
    expect(editor.getAction).toHaveBeenCalled();
    expect(action.isSupported).toHaveBeenCalled();
    expect(action.run).toHaveBeenCalledTimes(0);
  });

  describe('toggleEditorOption()', () => {
    it('handles a missing ElectronFiddle global', () => {
      const oldEditors = ElectronFiddle.editors;
      ElectronFiddle.editors = undefined as any;

      const wrapper = shallow(<Editors appState={store as any} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
      ElectronFiddle.editors = oldEditors;
    });

    it('handles an error', () => {
      (ElectronFiddle.editors[DefaultEditorId.html]!
        .updateOptions as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Bwap bwap');
      });

      const wrapper = shallow(<Editors appState={store as any} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
    });

    it('updates a setting', () => {
      const wrapper = shallow(<Editors appState={store as any} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(true);
      expect(
        ElectronFiddle.editors[DefaultEditorId.html]!.updateOptions,
      ).toHaveBeenCalledWith({
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
    store.mosaicArrangement = DefaultEditorId.main;
    const wrapper = shallow(<Editors appState={store as any} />);
    const instance: Editors = wrapper.instance() as any;
    const toolbar = instance.renderToolbar(
      { title: DefaultEditorId.main } as any,
      DefaultEditorId.main,
    );

    expect(toolbar).toMatchSnapshot();
  });

  it('componentWillUnmount() unsubscribes the layout reaction', () => {
    const wrapper = shallow(<Editors appState={store as any} />);
    const instance: Editors = wrapper.instance() as any;
    (instance as any).disposeLayoutAutorun = jest.fn();

    wrapper.unmount();

    expect(instance.disposeLayoutAutorun).toHaveBeenCalledTimes(1);
  });

  it('onChange() updates the mosaic arrangement in the appState', () => {
    const wrapper = shallow(<Editors appState={store as any} />);
    const instance: Editors = wrapper.instance() as any;

    instance.onChange({ testArrangement: true } as any);

    expect(store.mosaicArrangement).toEqual({ testArrangement: true });
  });

  describe('IPC commands', () => {
    it('handles a MONACO_EXECUTE_COMMAND command', () => {
      shallow(<Editors appState={store as any} />);

      const editor = new MonacoEditorMock();
      const action = editor.getAction();
      action.isSupported.mockReturnValue(true);

      (getFocusedEditor as any).mockReturnValueOnce(editor);

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
      const { app } = ElectronFiddle;

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
        (getFocusedEditor as any).mockReturnValueOnce(editor);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);

        await process.nextTick;
        expect(editor.setSelection).toHaveBeenCalledWith('range');
      });

      it('does not change selection if the selected editor has no model', async () => {
        shallow(<Editors appState={store as any} />);

        const editor = new MonacoEditorMock();
        delete (editor as any).model;
        (getFocusedEditor as any).mockReturnValueOnce(editor);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);

        await process.nextTick;
        expect(editor.getModel).toHaveBeenCalledTimes(1);
        expect(editor.setSelection).not.toHaveBeenCalled();
      });

      it('does not crash if there is no selected editor', () => {
        shallow(<Editors appState={store as any} />);
        (getFocusedEditor as any).mockReturnValueOnce(null);
        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);
      });
    });

    it('handles an FS_NEW_TEST command', async () => {
      const { app } = ElectronFiddle;

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
      (getFocusedEditor as any).mockReturnValueOnce(editor);

      ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);
      await process.nextTick;

      expect(editor.setSelection).toHaveBeenCalledWith(range);
    });

    it('handles the monaco editor option commands', () => {
      shallow(<Editors appState={store as any} />);

      ipcRendererManager.emit(IpcEvents.MONACO_TOGGLE_OPTION, null, 'wordWrap');

      const { editors: eds } = ElectronFiddle;
      expect(eds[DefaultEditorId.html]!.updateOptions).toHaveBeenCalled();
      expect(eds[DefaultEditorId.renderer]!.updateOptions).toHaveBeenCalled();
      expect(eds[DefaultEditorId.main]!.updateOptions).toHaveBeenCalled();
    });
  });

  describe('loadMonaco()', () => {
    it('loads Monaco', async () => {
      ElectronFiddle.app.monaco = null;

      shallow(<Editors appState={store as any} />);

      await process.nextTick;
      expect(ElectronFiddle.app.monaco).toEqual({ monaco: true });
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

  describe('disposeLayoutAutorun()', () => {
    it('automatically updates the layout when the mosaic arrangement changes', () => {
      shallow(<Editors appState={store as any} />);
      store.mosaicArrangement = DefaultEditorId.main;
      expect(updateEditorLayout).toHaveBeenCalledTimes(1);
    });
  });
});
