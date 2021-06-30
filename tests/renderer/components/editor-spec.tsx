import { shallow } from 'enzyme';
import * as React from 'react';

import { DefaultEditorId, MAIN_JS } from '../../../src/interfaces';
import { Editor } from '../../../src/renderer/components/editor';

import { StateMock } from '../../mocks/mocks';

describe('Editor component', () => {
  let store: StateMock;
  let monaco: any;

  beforeEach(() => {
    ({ monaco } = window.ElectronFiddle);
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  it('renders the editor container', () => {
    const wrapper = shallow(
      <Editor
        appState={store as any}
        monaco={monaco}
        monacoOptions={{}}
        id={DefaultEditorId.main}
        setFocused={() => undefined}
      />,
    );

    expect(wrapper.html()).toBe('<div class="editorContainer"></div>');
  });

  it('correctly sets the language', () => {
    let wrapper = shallow(
      <Editor
        appState={store as any}
        monaco={monaco}
        monacoOptions={{}}
        id={DefaultEditorId.main}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('javascript');

    wrapper = shallow(
      <Editor
        appState={store as any}
        monaco={monaco}
        monacoOptions={{}}
        id={DefaultEditorId.html}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('html');

    wrapper = shallow(
      <Editor
        appState={store as any}
        monaco={monaco}
        monacoOptions={{}}
        id={DefaultEditorId.css}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('css');
  });

  it('denies updates', () => {
    const wrapper = shallow(
      <Editor
        appState={store as any}
        monaco={monaco}
        monacoOptions={{}}
        id={DefaultEditorId.main}
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
    it('calls editorMosaic.addEditor', async () => {
      const didMount = jest.fn();
      const { editorMosaic } = store;
      const addEditorSpy = jest.spyOn(editorMosaic, 'addEditor');

      const id = MAIN_JS;
      editorMosaic.set({ [MAIN_JS]: '// content' });
      const wrapper = shallow(
        <Editor
          appState={store as any}
          monaco={monaco}
          monacoOptions={{}}
          id={id}
          editorDidMount={didMount}
          setFocused={() => undefined}
        />,
      );
      const instance: any = wrapper.instance();
      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(didMount).toHaveBeenCalled();
      expect(addEditorSpy).toHaveBeenCalledWith(id, expect.anything());
    });

    it('sets up a listener on focused text editor', async () => {
      store.editorMosaic.set({ [MAIN_JS]: '// content' });
      const wrapper = shallow(
        <Editor
          appState={store as any}
          monaco={monaco}
          monacoOptions={{}}
          id={MAIN_JS}
          editorDidMount={() => undefined}
          setFocused={() => undefined}
        />,
      );
      const instance: any = wrapper.instance();

      instance.containerRef.current = 'ref';
      await instance.initMonaco();
      expect(monaco.latestEditor.onDidFocusEditorText).toHaveBeenCalled();
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const didMount = jest.fn();

    store.editorMosaic.set({ [MAIN_JS]: '// content' });
    const wrapper = shallow(
      <Editor
        appState={store as any}
        monaco={monaco}
        monacoOptions={{}}
        id={MAIN_JS}
        editorDidMount={didMount}
        setFocused={() => undefined}
      />,
    );
    const instance: any = wrapper.instance();

    instance.containerRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(monaco.latestEditor.dispose).toHaveBeenCalled();
  });
});
