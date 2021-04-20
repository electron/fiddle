import * as React from 'react';
import { shallow } from 'enzyme';

import { Editor } from '../../../src/renderer/components/editor';
import { MAIN_JS } from '../../../src/interfaces';

import { AppMock } from '../../mocks/app';

describe('Editor component', () => {
  let app: AppMock;
  let monaco: any;
  const editorDispose = jest.fn();

  beforeEach(() => {
    ({ app } = (window as any).ElectronFiddle);
    ({ monaco } = app);

    editorDispose.mockReset();
  });

  function createEditorComponent(didMount: any = undefined) {
    const wrapper = shallow(
      <Editor
        appState={app.state as any}
        editorMosaic={app.editorMosaic as any}
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
        appState={app.state as any}
        editorMosaic={app.editorMosaic as any}
        monaco={monaco}
        monacoOptions={{}}
        id={MAIN_JS}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('javascript');

    wrapper = shallow(
      <Editor
        appState={app.state as any}
        editorMosaic={app.editorMosaic as any}
        monaco={monaco}
        monacoOptions={{}}
        id={'foo.html'}
        setFocused={() => undefined}
      />,
    );

    expect((wrapper.instance() as any).language).toBe('html');

    wrapper = shallow(
      <Editor
        appState={app.state as any}
        editorMosaic={app.editorMosaic as any}
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
      const didMount = jest.fn();
      const { instance } = createEditorComponent(didMount);

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(didMount).toHaveBeenCalled();
      expect(monaco.editor.create).toHaveBeenCalled();
      expect(app.editorMosaic.addEditor).toHaveBeenCalled();
    });
  });

  it('sets up a listener on focused text editor', async () => {
    const didMount = jest.fn();
    const { instance } = createEditorComponent(didMount);

    instance.containerRef.current = 'ref';
    await instance.initMonaco();

    expect(monaco.lastCreated.onDidFocusEditorText).toHaveBeenCalled();
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const didMount = jest.fn();
    const { instance } = createEditorComponent(didMount);

    instance.containerRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(monaco.lastCreated.dispose).toHaveBeenCalled();
  });
});
