import * as React from 'react';

import { mount, shallow } from 'enzyme';
import { MosaicWindowProps } from 'react-mosaic-component';

import { EditorId, EditorValues, MAIN_JS } from '../../../src/interfaces';
import { App } from '../../../src/renderer/app';
import { Editors } from '../../../src/renderer/components/editors';
import { Editor, EditorMosaic } from '../../../src/renderer/editor-mosaic';
import { AppState } from '../../../src/renderer/state';
import {
  MonacoEditorMock,
  MonacoMock,
  StateMock,
  createEditorValues,
} from '../../mocks/mocks';
import { emitEvent } from '../../utils';

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
    ({ app } = window);
    monaco = window.monaco as unknown as MonacoMock;
    ({ state: store } = window.app);
    editorValues = createEditorValues();
    editorMosaic = new EditorMosaic();
    editorMosaic.set(editorValues);

    (store as unknown as StateMock).editorMosaic = editorMosaic;
  });

  it('renders', () => {
    const wrapper = mount(<Editors appState={store} />);
    wrapper.setState({ monaco });
    expect(wrapper).toMatchSnapshot();
  });

  it('does not execute command if not supported', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: any = wrapper.instance();

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
      editorMosaic.addEditor(filename, editor as unknown as Editor);
      editor.updateOptions.mockImplementationOnce(() => {
        throw new Error('Bwap bwap');
      });

      const wrapper = shallow(<Editors appState={store} />);
      const instance: any = wrapper.instance();

      expect(instance.toggleEditorOption('wordWrap')).toBe(false);
    });

    it('updates a setting', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: any = wrapper.instance();

      const editor = new MonacoEditorMock();
      editorMosaic.addEditor(filename, editor as unknown as Editor);
      expect(instance.toggleEditorOption('wordWrap')).toBe(true);
      expect(editor.updateOptions).toHaveBeenCalledWith({
        minimap: { enabled: false },
        wordWrap: 'off',
      });
    });
  });

  it('renders a toolbar', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: any = wrapper.instance();
    const toolbar = instance.renderToolbar(
      { title: MAIN_JS } as MosaicWindowProps<EditorId>,
      MAIN_JS,
    );

    expect(toolbar).toMatchSnapshot();
  });

  it('onChange() updates the mosaic arrangement in the appState', () => {
    const wrapper = shallow(<Editors appState={store} />);
    const instance: any = wrapper.instance();

    const arrangement = { testArrangement: true };
    instance.onChange(arrangement as any);
    expect(editorMosaic.mosaic).toStrictEqual(arrangement);
  });

  describe('events', () => {
    it('handles a "execute-monaco-command" event', () => {
      shallow(<Editors appState={store} />);

      const editor = new MonacoEditorMock();
      const action = editor.getAction();
      action.isSupported.mockReturnValue(true);

      editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

      emitEvent('execute-monaco-command', 'hello');
      expect(editor.getAction).toHaveBeenCalled();
      expect(action.isSupported).toHaveBeenCalled();
      expect(action.run).toHaveBeenCalled();
    });

    const fakeValues = { [MAIN_JS]: 'hi' } as const;

    it('handles a "new-fiddle" event', async () => {
      shallow(<Editors appState={store} />);

      let resolve: (value?: unknown) => void;
      const replacePromise = new Promise((r) => {
        resolve = r;
      });

      // setup
      const getTemplateSpy = jest
        .spyOn(window.ElectronFiddle, 'getTemplate')
        .mockResolvedValue(fakeValues);
      const replaceFiddleSpy = jest
        .spyOn(app, 'replaceFiddle')
        .mockImplementation(async () => {
          resolve();
          return true;
        });

      // invoke the call
      emitEvent('new-fiddle');
      await replacePromise;

      // check the results
      expect(getTemplateSpy).toHaveBeenCalledTimes(1);
      expect(replaceFiddleSpy).toHaveBeenCalledTimes(1);

      // cleanup
      getTemplateSpy.mockRestore();
      replaceFiddleSpy.mockRestore();
    });

    describe('"select-all-in-editor" handler', () => {
      it('selects all in the focused editor', async () => {
        shallow(<Editors appState={store} />);

        const range = 'range';
        const editor = new MonacoEditorMock();
        const model = editor.getModel();
        model.getFullModelRange.mockReturnValue(range);
        editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

        emitEvent('select-all-in-editor');

        await new Promise(process.nextTick);
        expect(editor.setSelection).toHaveBeenCalledWith('range');
      });

      it('does not change selection if the selected editor has no model', async () => {
        shallow(<Editors appState={store} />);

        const editor = new MonacoEditorMock();
        delete (editor as any).model;
        editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

        emitEvent('select-all-in-editor');

        await new Promise(process.nextTick);
        expect(editor.getModel).toHaveBeenCalledTimes(1);
        expect(editor.setSelection).not.toHaveBeenCalled();
      });

      it('does not crash if there is no selected editor', () => {
        shallow(<Editors appState={store} />);
        editorMosaic.focusedEditor = jest.fn().mockReturnValue(null);
        emitEvent('select-all-in-editor');
      });
    });

    it('handles a "new-test" event', async () => {
      shallow(<Editors appState={store} />);

      // setup
      const getTestTemplateSpy = jest
        .spyOn(window.ElectronFiddle, 'getTestTemplate')
        .mockResolvedValue(fakeValues);
      let replaceResolve: (value?: unknown) => void;
      const replacePromise = new Promise((r) => {
        replaceResolve = r;
      });
      const replaceFiddleSpy = jest
        .spyOn(app, 'replaceFiddle')
        .mockImplementation(async () => {
          replaceResolve();
          return true;
        });

      // invoke the call
      emitEvent('new-test');
      await replacePromise;

      // check the results
      expect(getTestTemplateSpy).toHaveBeenCalled();
      expect(replaceFiddleSpy).toHaveBeenCalled();

      // cleanup
      getTestTemplateSpy.mockRestore();
      replaceFiddleSpy.mockRestore();
    });

    it('handles a "select-all-in-editor" event', async () => {
      shallow(<Editors appState={store} />);

      const range = 'range';
      const editor = new MonacoEditorMock();
      editor.getModel().getFullModelRange.mockReturnValue(range);
      editorMosaic.focusedEditor = jest.fn().mockReturnValue(editor);

      emitEvent('select-all-in-editor');
      await new Promise(process.nextTick);

      expect(editor.setSelection).toHaveBeenCalledWith(range);
    });

    it('handles the monaco editor option event', () => {
      const id = MAIN_JS;
      const editor = new MonacoEditorMock();
      editorMosaic.addEditor(id, editor as unknown as Editor);

      shallow(<Editors appState={store} />);
      emitEvent('toggle-monaco-option', 'wordWrap');
      expect(editor.updateOptions).toHaveBeenCalled();
    });
  });

  describe('setFocused()', () => {
    it('sets the "focused" property', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: any = wrapper.instance();
      const spy = jest.spyOn(instance, 'setState');

      const id = MAIN_JS;
      instance.setFocused(id);
      expect(spy).toHaveBeenCalledWith({ focused: id });
    });

    it('focus sidebar file', () => {
      const wrapper = shallow(<Editors appState={store} />);
      const instance: any = wrapper.instance();
      const spy = jest.spyOn(instance, 'setState');

      const id = MAIN_JS;
      instance.setFocused(id);
      expect(spy).toHaveBeenCalledWith({ focused: id });
      expect(instance.props.appState.editorMosaic.focusedFile).toBe(id);
    });
  });
});
