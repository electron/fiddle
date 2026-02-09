import * as React from 'react';

import { render } from '@testing-library/react';
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
    const { container } = render(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
    );
    const outputDiv = container.querySelector('.output');
    expect(outputDiv).toBeInTheDocument();
    expect(outputDiv).toHaveStyle('display: inline-block');
  });

  it('correctly sets the language', () => {
    const ref = React.createRef<any>();
    render(
      <Output appState={store} monaco={monaco} monacoOptions={{}} ref={ref} />,
    );

    expect(ref.current.language).toBe('consoleOutputLanguage');
  });

  describe('initMonaco()', () => {
    it('attempts to create an editor', async () => {
      const ref = React.createRef<any>();
      render(
        <Output
          appState={store}
          monaco={monaco}
          monacoOptions={{}}
          ref={ref}
        />,
      );
      const instance = ref.current;

      instance.outputRef.current = 'ref';
      await instance.initMonaco();

      expect(monaco.editor.create).toHaveBeenCalled();
      expect(monaco.editor.createModel).toHaveBeenCalled();
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const ref = React.createRef<any>();
    render(
      <Output appState={store} monaco={monaco} monacoOptions={{}} ref={ref} />,
    );
    const instance = ref.current;

    instance.outputRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(
      (monaco as unknown as MonacoMock).latestEditor.dispose,
    ).toHaveBeenCalled();
  });

  it('hides the console with react-mosaic-component', async () => {
    const ref = React.createRef<any>();
    render(
      <Output appState={store} monaco={monaco} monacoOptions={{}} ref={ref} />,
    );
    const instance = ref.current;

    // direction is required to be recognized as a valid root node
    mockContext.mosaicActions.getRoot.mockReturnValue({
      splitPercentage: 25,
      direction: 'row',
    });

    instance.context = mockContext;
    instance.outputRef.current = 'ref';
    await instance.initMonaco();

    // Trigger toggleConsole explicitly
    instance.toggleConsole();

    expect(mockContext.mosaicActions.replaceWith).toHaveBeenCalled();
    expect(mockContext.mosaicActions.replaceWith).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ splitPercentage: 25 }),
    );
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

    const ref = React.createRef<any>();
    render(
      <Output appState={store} monaco={monaco} monacoOptions={{}} ref={ref} />,
    );
    const instance = ref.current;

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

    const ref = React.createRef<any>();
    render(
      <Output appState={store} monaco={monaco} monacoOptions={{}} ref={ref} />,
    );
    const instance = ref.current;
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
    const ref = React.createRef<any>();
    render(
      <Output appState={store} monaco={monaco} monacoOptions={{}} ref={ref} />,
    );
    const instance = ref.current;
    const spy = vi.spyOn(instance, 'toggleConsole');

    instance.outputRef.current = 'ref';
    await instance.initMonaco();

    await instance.updateModel();
    expect(spy).toHaveBeenCalled();
  });
});
