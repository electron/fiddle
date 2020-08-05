import { shallow } from 'enzyme';
import * as React from 'react';

import { EditorId } from '../../../src/interfaces';
import { Editor } from '../../../src/renderer/components/editor';

describe('Editor component', () => {
  let store: any;
  let monaco: any;
  const editorDispose = jest.fn();
  const updateOptions = jest.fn();
  const onDidFocusEditorText = jest.fn();

  beforeEach(() => {
    store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false,
      closedPanels: {},
      getAndRemoveEditorValueBackup: jest.fn(),
    };

    editorDispose.mockReset();

    monaco = {
      editor: {
        create: jest.fn(() => ({
          dispose: editorDispose,
          onDidFocusEditorText,
          setModel: jest.fn(),
          restoreViewState: jest.fn(),
        })),
        createModel: jest.fn(() => ({
          updateOptions,
        })),
        setModel: jest.fn(),
        dispose: jest.fn(),
      },
    };
  });

  it('renders the editor container', () => {
    const wrapper = shallow(
      <Editor
        appState={store}
        monaco={monaco}
        monacoOptions={{}}
        id={EditorId.main}
        setFocused={() => undefined}
      />,
    );

    expect(wrapper.html()).toBe('<div class="editorContainer"></div>');
  });

  it('correctly sets the language', () => {
    let wrapper = shallow(
      <Editor
        appState={store}
        monaco={monaco}
        monacoOptions={{}}
        id={EditorId.main}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('javascript');

    wrapper = shallow(
      <Editor
        appState={store}
        monaco={monaco}
        monacoOptions={{}}
        id={EditorId.html}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('html');

    wrapper = shallow(
      <Editor
        appState={store}
        monaco={monaco}
        monacoOptions={{}}
        id={EditorId.css}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('css');
  });

  it('denies updates', () => {
    const wrapper = shallow(
      <Editor
        appState={store}
        monaco={monaco}
        monacoOptions={{}}
        id={EditorId.main}
        setFocused={() => undefined}
      />,
    );

    expect(
      (wrapper as any)
        .instance()
        .shouldComponentUpdate(null as any, null as any, null as any),
    ).toBe(false);
  });

  describe('initMonaco()', async () => {
    it('attempts to create an editor', async () => {
      const didMount = jest.fn();
      const wrapper = shallow(
        <Editor
          appState={store}
          monaco={monaco}
          monacoOptions={{}}
          id={EditorId.main}
          editorDidMount={didMount}
          setFocused={() => undefined}
        />,
      );
      const instance: any = wrapper.instance();

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(didMount).toHaveBeenCalled();
      expect(monaco.editor.create).toHaveBeenCalled();
      expect(monaco.editor.createModel).toHaveBeenCalled();
    });

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
            id={EditorId.main}
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
            id={EditorId.main}
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
          id={EditorId.main}
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
          id={EditorId.main}
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
        id={EditorId.main}
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
});
