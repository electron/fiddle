import { shallow } from 'enzyme';
import * as React from 'react';

import { Editor } from '../../../src/renderer/components/editor';

describe('Editor component', () => {
  beforeEach(() => {
    this.store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false
    };

    this.editorDispose = jest.fn();

    this.monaco = {
      editor: {
        create: jest.fn(() => ({
          dispose: this.editorDispose
        })),
        dispose: jest.fn()
      }
    };
  });

  it('renders the editor container', () => {
    const wrapper = shallow(
      <Editor appState={this.store} monaco={this.monaco} id='main'/>
    );

    expect(wrapper.html()).toBe('<div class="editorContainer"></div>');
  });

  it('correctly sets the language', () => {
    let wrapper = shallow(
      <Editor appState={this.store} monaco={this.monaco} id='main'/>
    );

    expect((wrapper.instance() as any).language).toBe('javascript');

    wrapper = shallow(
      <Editor appState={this.store} monaco={this.monaco} id='html'/>
    );

    expect((wrapper.instance() as any).language).toBe('html');
  });

  it('denies updates', () => {
    const wrapper = shallow(
      <Editor appState={this.store} monaco={this.monaco} id='main'/>
    );

    expect(wrapper.instance().shouldComponentUpdate(null, null, null)).toBe(false);
  });

  it('initMonaco() attempts to create an editor', async () => {
    const didMount = jest.fn();
    const wrapper = shallow(
      <Editor
        appState={this.store}
        monaco={this.monaco}
        id='main'
        editorDidMount={didMount}
      />
    );
    const instance: any = wrapper.instance();

    instance.containerRef.current = 'ref';
    await instance.initMonaco();

    expect(didMount).toHaveBeenCalled();
    expect(this.monaco.editor.create).toHaveBeenCalled();
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const didMount = jest.fn();
    const wrapper = shallow(
      <Editor
        appState={this.store}
        monaco={this.monaco}
        id='main'
        editorDidMount={didMount}
      />
    );
    const instance: any = wrapper.instance();

    instance.containerRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(this.editorDispose).toHaveBeenCalled();
  });
});
