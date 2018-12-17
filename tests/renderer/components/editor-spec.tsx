import { shallow } from 'enzyme';
import * as React from 'react';

import { Editor } from '../../../src/renderer/components/editor';

describe('Editor component', () => {
  let store: any;
  let monaco: any;
  const editorDispose = jest.fn();

  beforeEach(() => {
    store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false
    };

    editorDispose.mockReset();

    monaco = {
      editor: {
        create: jest.fn(() => ({
          dispose: editorDispose
        })),
        dispose: jest.fn()
      }
    };
  });

  it('renders the editor container', () => {
    const wrapper = shallow(
      <Editor appState={store} monaco={monaco} monoacoOptions={{}} id='main'/>
    );

    expect(wrapper.html()).toBe('<div class="editorContainer"></div>');
  });

  it('correctly sets the language', () => {
    let wrapper = shallow(
      <Editor appState={store} monaco={monaco} monoacoOptions={{}} id='main'/>
    );

    expect((wrapper.instance() as any).language).toBe('javascript');

    wrapper = shallow(
      <Editor appState={store} monaco={monaco} monoacoOptions={{}} id='html'/>
    );

    expect((wrapper.instance() as any).language).toBe('html');
  });

  it('denies updates', () => {
    const wrapper = shallow(
      <Editor appState={store} monaco={monaco} monoacoOptions={{}} id='main'/>
    );

    expect((wrapper as any)
      .instance()
      .shouldComponentUpdate(null as any, null as any, null as any)
    ).toBe(false);
  });

  it('initMonaco() attempts to create an editor', async () => {
    const didMount = jest.fn();
    const wrapper = shallow(
      <Editor
        appState={store}
        monaco={monaco}
        monoacoOptions={{}}
        id='main'
        editorDidMount={didMount}
      />
    );
    const instance: any = wrapper.instance();

    instance.containerRef.current = 'ref';
    await instance.initMonaco();

    expect(didMount).toHaveBeenCalled();
    expect(monaco.editor.create).toHaveBeenCalled();
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const didMount = jest.fn();
    const wrapper = shallow(
      <Editor
        appState={store}
        monaco={monaco}
        monoacoOptions={{}}
        id='main'
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
