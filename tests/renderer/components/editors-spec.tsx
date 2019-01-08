import { shallow } from 'enzyme';
import * as React from 'react';

import { IpcEvents } from '../../../src/ipc-events';
import { Editors } from '../../../src/renderer/components/editors';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { getFocusedEditor } from '../../../src/utils/focused-editor';

jest.mock('monaco-loader', () => jest.fn(async () => {
  return { monaco: true };
}));

jest.mock('../../../src/renderer/components/editor', () => ({
  Editor: 'Editor'
}));

jest.mock('../../../src/utils/focused-editor', () => ({
  getFocusedEditor: jest.fn()
}));

describe('Editrors component', () => {
  let store: any;
  let monaco: any;

  beforeEach(() => {
    store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false,
      setWarningDialogTexts: () => ({})
    };

    monaco = {
      editor: {
        defineTheme: jest.fn()
      }
    };
  });

  it('renders', () => {
    const wrapper = shallow(<Editors appState={store} />);
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
      window.ElectronFiddle = undefined as any;

      const wrapper = shallow(<Editors appState={store} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
    });

    it('handles an error', () => {
      (window.ElectronFiddle.editors.html!.updateOptions as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error('Bwap bwap');
        }
      );

      const wrapper = shallow(<Editors appState={store} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
    });

    it('updates a setting', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: Editors = wrapper.instance() as any;

      expect(instance.toggleEditorOption('wordWrap')).toBe(true);
      expect(window.ElectronFiddle.editors.html!.updateOptions).toHaveBeenCalledWith(
        {
          minimap: { enabled: false },
          wordWrap: 'off'
        }
      );
    });
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
        expect(window.ElectronFiddle.app.setValues).toHaveBeenCalled();
        done();
      });
    });

    it('handles the monaco editor option commands', () => {
      shallow(<Editors appState={store} />);

      ipcRendererManager.emit(IpcEvents.MONACO_TOGGLE_OPTION, null, 'wordWrap');

      expect(window.ElectronFiddle.editors.html!.updateOptions).toHaveBeenCalled();
      expect(window.ElectronFiddle.editors.renderer!.updateOptions).toHaveBeenCalled();
      expect(window.ElectronFiddle.editors.main!.updateOptions).toHaveBeenCalled();
    });
  });

  describe('loadMonaco()', () => {
    it('loads Monaco', (done) => {
      window.ElectronFiddle.app.monaco = null;

      shallow(<Editors appState={store} />);

      process.nextTick(() => {
        expect(window.ElectronFiddle.app.monaco).toEqual({ monaco: true});
        done();
      });
    });
  });
});
