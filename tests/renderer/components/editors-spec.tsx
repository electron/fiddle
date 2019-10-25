import { mount, shallow } from 'enzyme';
import { observable } from 'mobx';
import * as React from 'react';

import { ALL_MOSAICS, DocsDemoPage, EditorId } from '../../../src/interfaces';
import { IpcEvents } from '../../../src/ipc-events';
import { Editors, TITLE_MAP } from '../../../src/renderer/components/editors';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { updateEditorLayout } from '../../../src/utils/editor-layout';
import { createMosaicArrangement } from '../../../src/utils/editors-mosaic-arrangement';
import { getFocusedEditor } from '../../../src/utils/focused-editor';

jest.mock('monaco-loader', () =>
  jest.fn(async () => {
    return { monaco: true };
  })
);

jest.mock('../../../src/renderer/components/editor', () => ({
  Editor: () => 'Editor'
}));

jest.mock('../../../src/utils/focused-editor', () => ({
  getFocusedEditor: jest.fn()
}));

jest.mock('../../../src/utils/editor-layout', () => ({
  updateEditorLayout: jest.fn()
}));

describe('Editors component', () => {
  let store: any;
  let monaco: any;

  beforeEach(() => {
    store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false,
      setWarningDialogTexts: () => ({}),
      mosaicArrangement: createMosaicArrangement(ALL_MOSAICS),
      currentDocsDemoPage: DocsDemoPage.DEFAULT
    };

    monaco = {
      editor: {
        defineTheme: jest.fn()
      }
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
      run: jest.fn()
    };
    const mockEditor = {
      getAction: jest.fn(() => mockAction)
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
      (window.ElectronFiddle.editors.html!
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
        window.ElectronFiddle.editors.html!.updateOptions
      ).toHaveBeenCalledWith({
        minimap: { enabled: false },
        wordWrap: 'off'
      });
    });
  });

  it('renders a toolbar', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: Editors = wrapper.instance() as any;
    const toolbar = instance.renderToolbar(
      { title: TITLE_MAP[EditorId.main] } as any,
      EditorId.main
    );

    expect(toolbar).toMatchSnapshot();
  });

  it('componentWillUnmount() unsubscribes the layout reaction', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: Editors = wrapper.instance() as any;
    (instance as any).disposeLayoutAutorun = jest.fn();

    instance.componentWillUnmount();

    expect(instance.disposeLayoutAutorun).toHaveBeenCalledTimes(1);
  });

  it('onChange() updates the mosaic arrangement in the appState', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: Editors = wrapper.instance() as any;

    instance.onChange({ testArrangement: true } as any);

    expect(store.mosaicArrangement).toEqual({ testArrangement: true });
  });

  describe('IPC commands', () => {
    it('handles an MONACO_EXECUTE_COMMAND command', () => {
      shallow(<Editors appState={store} />);

      const mockAction = {
        isSupported: jest.fn(() => true),
        run: jest.fn()
      };
      const mockEditor = {
        getAction: jest.fn(() => mockAction)
      };

      (getFocusedEditor as any).mockReturnValueOnce(mockEditor);

      ipcRendererManager.emit(IpcEvents.MONACO_EXECUTE_COMMAND, null, 'hello');
      expect(mockEditor.getAction).toHaveBeenCalled();
      expect(mockAction.isSupported).toHaveBeenCalled();
      expect(mockAction.run).toHaveBeenCalled();
    });

    it('handles an FS_NEW_FIDDLE command', (done) => {
      shallow(<Editors appState={store} />);

      ipcRendererManager.emit(IpcEvents.FS_NEW_FIDDLE, null);
      process.nextTick(() => {
        expect(window.ElectronFiddle.app.replaceFiddle).toHaveBeenCalled();
        done();
      });
    });

    it('handles the monaco editor option commands', () => {
      shallow(<Editors appState={store} />);

      ipcRendererManager.emit(IpcEvents.MONACO_TOGGLE_OPTION, null, 'wordWrap');

      expect(
        window.ElectronFiddle.editors.html!.updateOptions
      ).toHaveBeenCalled();
      expect(
        window.ElectronFiddle.editors.renderer!.updateOptions
      ).toHaveBeenCalled();
      expect(
        window.ElectronFiddle.editors.main!.updateOptions
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

  describe('disposeLayoutAutorun()', () => {
    it('automatically updates the layout when the mosaic arrangement changes', () => {
      class MockStore {
        @observable public mosaicArrangement: any = {};
      }

      const mockStore = new MockStore();

      shallow(<Editors appState={mockStore as any} />);

      mockStore.mosaicArrangement = EditorId.main;

      expect(updateEditorLayout).toHaveBeenCalledTimes(1);
    });
  });
});
