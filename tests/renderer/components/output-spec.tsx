import * as React from 'react';

import { shallow } from 'enzyme';
import type * as MonacoType from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Output } from '../../../src/renderer/components/output';
import { AppState } from '../../../src/renderer/state';
import { MonacoMock } from '../../mocks/mocks';

const mockContext = {
  mosaicActions: {
    expand: vi.fn(),
    remove: vi.fn(),
    hide: vi.fn(),
    replaceWith: vi.fn(),
    updateTree: vi.fn(),
    getRoot: vi.fn(),
  },
  mosaicId: 'output',
};

describe('Output component', () => {
  let store: AppState;
  let monaco: typeof MonacoType;

  beforeEach(() => {
    monaco = window.monaco;
    ({ state: store } = window.app);
  });

  it('renders the output container', () => {
    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
    );
    expect(wrapper.html()).toBe(
      '<div class="output" style="display:inline-block"></div>',
    );
  });

  it('correctly sets the language', () => {
    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
    );

    expect((wrapper.instance() as any).language).toBe('consoleOutputLanguage');
  });

  describe('initMonaco()', () => {
    it('attempts to create an editor', async () => {
      const wrapper = shallow(
        <Output appState={store} monaco={monaco} monacoOptions={{}} />,
      );
      const instance: any = wrapper.instance();

      instance.outputRef.current = 'ref';
      await instance.initMonaco();

      expect(monaco.editor.create).toHaveBeenCalled();
      expect(monaco.editor.createModel).toHaveBeenCalled();
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
    );
    const instance: any = wrapper.instance();

    instance.outputRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(
      (monaco as unknown as MonacoMock).latestEditor.dispose,
    ).toHaveBeenCalled();
  });

  it('hides the console with react-mosaic-component', async () => {
    // manually trigger lifecycle methods so that
    // context can be set before mounting method
    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
      {
        context: mockContext,
        disableLifecycleMethods: true,
      },
    );
    const instance: any = wrapper.instance();

    // Todo: There's a scary bug here in Jest / Enzyme. At this point in time,
    // the context is {}. That's never the case in production.
    // direction is required to be recognized as a valid root node
    mockContext.mosaicActions.getRoot.mockReturnValue({
      splitPercentage: 25,
      direction: 'row',
    });

    wrapper.instance().context = mockContext;
    wrapper.instance().componentDidMount!();

    instance.outputRef.current = 'ref';
    await instance.initMonaco();

    expect(mockContext.mosaicActions.replaceWith).toHaveBeenCalled();
    expect(mockContext.mosaicActions.replaceWith).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ splitPercentage: 25 }),
    );
    expect(wrapper.html()).not.toBe(null);
  });

  it('updateModel updates model with correct values', async () => {
    store.output = [
      {
        text: 'Hi!',
        timeString: '12:00:01 PM',
      },
      {
        isNotPre: true,
        text: 'Hi!',
        timeString: '12:00:01 PM',
      },
    ];

    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
    );
    const instance: any = wrapper.instance();

    instance.outputRef.current = 'ref';
    await instance.initMonaco();
    instance.updateModel();

    expect(monaco.editor.createModel).toHaveBeenCalled();
    expect(instance.editor?.revealLine).toHaveBeenCalled();
  });

  it('updateModel correctly observes and gets called when output is updated', async () => {
    store.output = [
      {
        timeString: '12:00:01 PM',
        text: 'Hi!',
      },
    ];

    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
    );

    const instance: any = wrapper.instance();
    const spy = vi.spyOn(instance, 'updateModel');

    instance.outputRef.current = 'ref';
    await instance.initMonaco();

    instance.updateModel();

    // new output
    store.output = [
      {
        timeString: '12:00:01 PM',
        text: 'Hi!',
      },
      {
        timeString: '12:00:01 PM',
        text: 'Hi!',
        isNotPre: true,
      },
    ];
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('handles componentDidUpdate', async () => {
    // set up component
    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
    );
    const instance: any = wrapper.instance();
    const spy = vi.spyOn(instance, 'toggleConsole');

    instance.outputRef.current = 'ref';
    await instance.initMonaco();

    await instance.updateModel();
    expect(spy).toHaveBeenCalled();
  });
});
