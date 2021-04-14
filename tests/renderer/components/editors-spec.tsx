import { mount, shallow } from 'enzyme';
import { observable } from 'mobx';
import * as React from 'react';

import {
  ALL_MOSAICS,
  DocsDemoPage,
  DefaultEditorId,
} from '../../../src/interfaces';
import { IpcEvents } from '../../../src/ipc-events';
import { Editors } from '../../../src/renderer/components/editors';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { updateEditorLayout } from '../../../src/utils/editor-layout';
import { createMosaicArrangement } from '../../../src/utils/editors-mosaic-arrangement';
import { getFocusedEditor } from '../../../src/utils/focused-editor';
import * as content from '../../../src/renderer/content';

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
  let store: any;
  let monaco: any;

  beforeEach(() => {
    store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false,
      setGenericDialogOptions: () => ({}),
      mosaicArrangement: createMosaicArrangement(ALL_MOSAICS),
      currentDocsDemoPage: DocsDemoPage.DEFAULT,
      customMosaics: [],
    };

    monaco = {
      editor: {
        defineTheme: jest.fn(),
      },
    };
  });

  it('renders', () => {
    const wrapper = mount(<Editors appState={store} />);
    wrapper.setState({ monaco });
    expect(wrapper).toMatchSnapshot();
  });

  it('does not execute command if not supported', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: Editors = wrapper.instance() as any;
    const mockAction = {
      isSupported: jest.fn(() => false),
      run: jest.fn(),
    };
    const mockEditor = {
      getAction: jest.fn(() => mockAction),
    };

    (getFocusedEditor as any).mockReturnValueOnce(mockEditor);

    instance.executeCommand('hello');
    expect(mockEditor.getAction).toHaveBeenCalled();
    expect(mockAction.isSupported).toHaveBeenCalled();
    expect(mockAction.run).toHaveBeenCalledTimes(0);
  });

  describe('toggleEditorOption()', () => {
    it('handles a missing ElectronFiddle global', () => {
      const oldEditors = window.ElectronFiddle.editors;
      window.ElectronFiddle.editors = undefined as any;

      const wrapper = shallow(<Editors appState={store} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
      window.ElectronFiddle.editors = oldEditors;
    });

    it('handles an error', () => {
      (window.ElectronFiddle.editors[DefaultEditorId.html]!
        .updateOptions as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Bwap bwap');
      });

      const wrapper = shallow(<Editors appState={store} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
    });

    it('updates a setting', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(true);
      expect(
        window.ElectronFiddle.editors[DefaultEditorId.html]!.updateOptions,
      ).toHaveBeenCalledWith({
        minimap: { enabled: false },
        wordWrap: 'off',
      });
    });
  });

  it('renders a toolbar', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: Editors = wrapper.instance() as any;
    const toolbar = instance.renderToolbar(
      { title: DefaultEditorId.main } as any,
      DefaultEditorId.main,
    );

    expect(toolbar).toMatchSnapshot();
  });

  it('does not render toolbar controls if only one editor exists', () => {
    store.mosaicArrangement = DefaultEditorId.main;
    const wrapper = shallow(<Editors appState={store} />);
    const instance: Editors = wrapper.instance() as any;
    const toolbar = instance.renderToolbar(
      { title: DefaultEditorId.main } as any,
      DefaultEditorId.main,
    );

    expect(toolbar).toMatchSnapshot();
  });

  it('componentWillUnmount() unsubscribes the layout reaction', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: Editors = wrapper.instance() as any;
    (instance as any).disposeLayoutAutorun = jest.fn();

    wrapper.unmount();

    expect(instance.disposeLayoutAutorun).toHaveBeenCalledTimes(1);
  });

  it('onChange() updates the mosaic arrangement in the appState', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: Editors = wrapper.instance() as any;

    instance.onChange({ testArrangement: true } as any);

    expect(store.mosaicArrangement).toEqual({ testArrangement: true });
  });

  describe('IPC commands', () => {
    it('handles a MONACO_EXECUTE_COMMAND command', () => {
      shallow(<Editors appState={store} />);

      const mockAction = {
        isSupported: jest.fn(() => true),
        run: jest.fn(),
      };
      const mockEditor = {
        getAction: jest.fn(() => mockAction),
      };

      (getFocusedEditor as any).mockReturnValueOnce(mockEditor);

      ipcRendererManager.emit(IpcEvents.MONACO_EXECUTE_COMMAND, null, 'hello');
      expect(mockEditor.getAction).toHaveBeenCalled();
      expect(mockAction.isSupported).toHaveBeenCalled();
      expect(mockAction.run).toHaveBeenCalled();
    });

    const fakeValues = Object.seal({
      [DefaultEditorId.css]: '',
      [DefaultEditorId.html]: '',
      [DefaultEditorId.main]: 'hi',
      [DefaultEditorId.preload]: '',
      [DefaultEditorId.renderer]: '',
    });

    it('handles an FS_NEW_FIDDLE command', async () => {
      const { app } = window.ElectronFiddle;

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
      it('selects all in the focused editor', (done) => {
        shallow(<Editors appState={store} />);
        const mockEditor = {
          getModel: () => ({
            getFullModelRange: jest.fn().mockReturnValue('range'),
          }),
          setSelection: jest.fn(),
        };
        (getFocusedEditor as any).mockReturnValueOnce(mockEditor);
        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);
        process.nextTick(() => {
          expect(mockEditor.setSelection).toHaveBeenCalledWith('range');
          done();
        });
      });

      it('does not change selection if the selected editor has no model', (done) => {
        shallow(<Editors appState={store} />);
        const mockEditor = {
          getModel: jest.fn(() => null),
          setSelection: jest.fn(),
        };
        (getFocusedEditor as any).mockReturnValueOnce(mockEditor);

        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);

        process.nextTick(() => {
          expect(mockEditor.getModel).toHaveBeenCalledTimes(1);
          expect(mockEditor.setSelection).not.toHaveBeenCalled();
          done();
        });
      });

      it('does not crash if there is no selected editor', () => {
        shallow(<Editors appState={store} />);
        (getFocusedEditor as any).mockReturnValueOnce(null);
        ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);
      });
    });

    it('handles an FS_NEW_TEST command', async () => {
      const { app } = window.ElectronFiddle;

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
    it('handles a SELECT_ALL_IN_EDITOR command', (done) => {
      shallow(<Editors appState={store} />);
      const mockEditor = {
        getModel: () => ({
          getFullModelRange: jest.fn().mockReturnValue('range'),
        }),
        setSelection: jest.fn(),
      };
      (getFocusedEditor as any).mockReturnValueOnce(mockEditor);
      ipcRendererManager.emit(IpcEvents.SELECT_ALL_IN_EDITOR, null);
      process.nextTick(() => {
        expect(mockEditor.setSelection).toHaveBeenCalledWith('range');
        done();
      });
    });

    it('handles the monaco editor option commands', () => {
      shallow(<Editors appState={store} />);

      ipcRendererManager.emit(IpcEvents.MONACO_TOGGLE_OPTION, null, 'wordWrap');

      expect(
        window.ElectronFiddle.editors[DefaultEditorId.html]!.updateOptions,
      ).toHaveBeenCalled();
      expect(
        window.ElectronFiddle.editors[DefaultEditorId.renderer]!.updateOptions,
      ).toHaveBeenCalled();
      expect(
        window.ElectronFiddle.editors[DefaultEditorId.main]!.updateOptions,
      ).toHaveBeenCalled();
    });
  });

  describe('loadMonaco()', () => {
    it('loads Monaco', (done) => {
      window.ElectronFiddle.app.monaco = null;

      shallow(<Editors appState={store} />);

      process.nextTick(() => {
        expect(window.ElectronFiddle.app.monaco).toEqual({ monaco: true });
        done();
      });
    });
  });

  describe('setFocused()', () => {
    it('sets the "focused" property', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: Editors = wrapper.instance() as any;
      const spy = jest.spyOn(instance, 'setState');

      const id = DefaultEditorId.html;
      instance.setFocused(id);
      expect(spy).toHaveBeenCalledWith({ focused: id });
    });
  });

  describe('disposeLayoutAutorun()', () => {
    it('automatically updates the layout when the mosaic arrangement changes', () => {
      class MockStore {
        @observable public mosaicArrangement: any = {};
      }

      const mockStore = new MockStore();

      shallow(<Editors appState={mockStore as any} />);

      mockStore.mosaicArrangement = DefaultEditorId.main;

      expect(updateEditorLayout).toHaveBeenCalledTimes(1);
    });
  });
});
