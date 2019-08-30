import { shallow } from 'enzyme';
import * as React from 'react';

import { EditorId } from '../../../src/interfaces';
import { Editor } from '../../../src/renderer/components/editor';

describe('Editor component', () => {
  let store: any;
  let monaco: any;
  const editorDispose = jest.fn();
  const updateOptions = jest.fn();

  beforeEach(() => {
    store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false,
      closedPanels: {},
      getAndRemoveEditorValueBackup: jest.fn()
    };

    editorDispose.mockReset();

    monaco = {
      editor: {
        create: jest.fn(() => ({
          dispose: editorDispose,
          setModel: jest.fn(),
          restoreViewState: jest.fn()
        })),
        createModel: jest.fn(() => ({
          updateOptions
        })),
        setModel: jest.fn(),
        dispose: jest.fn()
      }
    };
  });

  it('renders the editor container', () => {
    const wrapper = shallow(
      <Editor appState={store} monaco={monaco} monacoOptions={{}} id={EditorId.main} />
    );

    expect(wrapper.html()).toBe('<div class="editorContainer"></div>');
  });

  it('correctly sets the language', () => {
    let wrapper = shallow(
      <Editor appState={store} monaco={monaco} monacoOptions={{}} id={EditorId.main} />
    );

    expect((wrapper.instance() as any).language).toBe('javascript');

    wrapper = shallow(
      <Editor appState={store} monaco={monaco} monacoOptions={{}} id={EditorId.html} />
    );

    expect((wrapper.instance() as any).language).toBe('html');
  });

  it('denies updates', () => {
    const wrapper = shallow(
      <Editor appState={store} monaco={monaco} monacoOptions={{}} id={EditorId.main} />
    );

    expect((wrapper as any)
      .instance()
      .shouldComponentUpdate(null as any, null as any, null as any)
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
        />
      );
      const instance: any = wrapper.instance();

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(didMount).toHaveBeenCalled();
      expect(monaco.editor.create).toHaveBeenCalled();
      expect(monaco.editor.createModel).toHaveBeenCalled();
    });

    it('attempts to restore a backup if available', async () => {
      store.getAndRemoveEditorValueBackup.mockReturnValueOnce({
        model: true,
        viewState: true
      });

      const wrapper = shallow(
        <Editor
          appState={store}
          monaco={monaco}
          monacoOptions={{}}
          id={EditorId.main}
          editorDidMount={() => undefined}
        />
      );
      const instance: any = wrapper.instance();

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(instance.editor.restoreViewState).toHaveBeenCalledTimes(1);
      expect(instance.editor.setModel).toHaveBeenCalledTimes(1);
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
        />
      );
      const instance: any = wrapper.instance();

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(updateOptions).toHaveBeenCalledWith(expect.objectContaining({
        tabSize: 2
      }));
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
      />
    );
    const instance: any = wrapper.instance();

    instance.containerRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(editorDispose).toHaveBeenCalled();
  });
});
