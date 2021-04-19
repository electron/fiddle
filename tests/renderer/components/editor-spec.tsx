import * as React from 'react';
import { shallow } from 'enzyme';

import { App } from '../../../src/renderer/app';
import { Editor } from '../../../src/renderer/components/editor';
import { EditorMosaic } from '../../../src/renderer/editor-mosaic';
import { EditorValues, MAIN_JS } from '../../../src/interfaces';

import { MonacoEditorMock } from '../../mocks/monaco-editor';
import { createEditorValues } from '../../mocks/editor-values';

describe('Editor component', () => {
  let app: any;
  let store: any;
  let monaco: any;
  let editorMosaic: any;
  let editorValues: EditorValues;
  const editorDispose = jest.fn();
  const updateOptions = jest.fn();
  //   const onDidFocusEditorText = jest.fn();

  beforeEach(() => {
    store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false,
      closedPanels: {},
      getAndRemoveEditorValueBackup: jest.fn(),
    };

    editorDispose.mockReset();

    editorValues = createEditorValues();

    monaco = {
      editor: {
        create: jest.fn().mockImplementation(() => new MonacoEditorMock()),
        createModel: jest.fn(() => ({
          updateOptions,
        })),
        setModel: jest.fn(),
        dispose: jest.fn(),
      },
    };

    app = { monaco };
    editorMosaic = new EditorMosaic(app as App);
    (window as any).ElectronFiddle.app = app;
  });

  function createEditorComponent(didMount: any = undefined) {
    const wrapper = shallow(
      <Editor
        appState={store}
        editorMosaic={editorMosaic}
        monaco={monaco}
        monacoOptions={{}}
        id={MAIN_JS}
        editorDidMount={didMount}
        setFocused={() => undefined}
      />,
    );
    const instance: any = wrapper.instance();
    return { instance, wrapper };
  }

  it('renders the editor container', () => {
    const { wrapper } = createEditorComponent();
    expect(wrapper.html()).toBe('<div class="editorContainer"></div>');
  });

  it('correctly sets the language', () => {
    let wrapper = shallow(
      <Editor
        appState={store}
        editorMosaic={editorMosaic}
        monaco={monaco}
        monacoOptions={{}}
        id={MAIN_JS}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('javascript');

    wrapper = shallow(
      <Editor
        appState={store}
        editorMosaic={editorMosaic}
        monaco={monaco}
        monacoOptions={{}}
        id={'foo.html'}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('html');

    wrapper = shallow(
      <Editor
        appState={store}
        editorMosaic={editorMosaic}
        monaco={monaco}
        monacoOptions={{}}
        id={'foo.css'}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('css');
  });

  it('denies updates', () => {
    const { wrapper } = createEditorComponent();

    expect(
      (wrapper as any)
        .instance()
        .shouldComponentUpdate(null as any, null as any, null as any),
    ).toBe(false);
  });

  describe('initMonaco()', async () => {
    it('attempts to create an editor', async () => {
      editorMosaic.set(editorValues);

      const didMount = jest.fn();
      const { instance } = createEditorComponent(didMount);

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(didMount).toHaveBeenCalled();
      expect(monaco.editor.create).toHaveBeenCalled();
      expect(monaco.editor.createModel).toHaveBeenCalled();
    });
  });

  /*
    describe('backups', async () => {
      it('attempts to restore a backup if contains a model', async () => {
        store.getAndRemoveEditorValueBackup.mockReturnValueOnce({
          model: true,
          viewState: true,
        });

        const wrapper = shallow(
          <Editor
            appState={store}
            monaco={monaco}
            monacoOptions={{}}
            id={DefaultEditorId.main}
            editorDidMount={() => undefined}
            setFocused={() => undefined}
          />,
        );
        const instance: any = wrapper.instance();

        instance.containerRef.current = 'ref';
        await instance.initMonaco();

        expect(instance.editor.restoreViewState).toHaveBeenCalledTimes(1);
        expect(instance.editor.setModel).toHaveBeenCalledTimes(1);
      });

      it('attempts to restore a backup if contains a string value', async () => {
        store.getAndRemoveEditorValueBackup.mockReturnValueOnce({
          value: 'hello',
        });

        const wrapper = shallow(
          <Editor
            appState={store}
            monaco={monaco}
            monacoOptions={{}}
            id={DefaultEditorId.main}
            editorDidMount={() => undefined}
            setFocused={() => undefined}
          />,
        );
        const instance: any = wrapper.instance();

        instance.containerRef.current = 'ref';
        await instance.initMonaco();

        expect(instance.editor.restoreViewState).toHaveBeenCalledTimes(0);
        expect(instance.editor.setModel).toHaveBeenCalledTimes(1);
        expect(monaco.editor.createModel).toHaveBeenCalledWith(
          'hello',
          'javascript',
        );
      });
    });

    it('initializes with a fixed tab size', async () => {
      const didMount = jest.fn();
      const wrapper = shallow(
        <Editor
          appState={store}
          monaco={monaco}
          monacoOptions={{}}
          id={DefaultEditorId.main}
          editorDidMount={didMount}
          setFocused={() => undefined}
        />,
      );
      const instance: any = wrapper.instance();

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(updateOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          tabSize: 2,
        }),
      );
    });

    it('sets up a listener on focused text editor', async () => {
      const wrapper = shallow(
        <Editor
          appState={store}
          monaco={monaco}
          monacoOptions={{}}
          id={DefaultEditorId.main}
          editorDidMount={() => undefined}
          setFocused={() => undefined}
        />,
      );
      const instance: any = wrapper.instance();

      instance.containerRef.current = 'ref';
      await instance.initMonaco();
      expect(onDidFocusEditorText).toHaveBeenCalled();
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const didMount = jest.fn();
    const wrapper = shallow(
      <Editor
        appState={store}
        monaco={monaco}
        monacoOptions={{}}
        id={DefaultEditorId.main}
        editorDidMount={didMount}
        setFocused={() => undefined}
      />,
    );
    const instance: any = wrapper.instance();

    instance.containerRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(editorDispose).toHaveBeenCalled();
  });
  */
});
