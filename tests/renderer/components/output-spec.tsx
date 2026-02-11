import * as React from 'react';

import { render } from '@testing-library/react';
import type * as MonacoType from 'monaco-editor';
import { MosaicContext } from 'react-mosaic-component';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Output } from '../../../src/renderer/components/output';
import { AppState } from '../../../src/renderer/state';
import { MonacoMock } from '../../mocks/mocks';

const mockMosaicActions = {
  expand: vi.fn(),
  remove: vi.fn(),
  hide: vi.fn(),
  replaceWith: vi.fn(),
  updateTree: vi.fn(),
  getRoot: vi.fn(),
};

const mockContextValue = {
  mosaicActions: mockMosaicActions,
  mosaicId: 'output',
} as any;

function renderOutput(store: AppState, monaco: typeof MonacoType) {
  const ref = React.createRef<any>();
  const renderResult = render(
    <MosaicContext.Provider value={mockContextValue}>
      <Output appState={store} monaco={monaco} monacoOptions={{}} ref={ref} />
    </MosaicContext.Provider>,
  );
  return { instance: ref.current!, renderResult };
}

describe('Output component', () => {
  let store: AppState;
  let monaco: typeof MonacoType;

  beforeEach(() => {
    monaco = window.monaco;
    ({ state: store } = window.app);
    vi.clearAllMocks();
  });

  it('renders the output container', () => {
    const { renderResult } = renderOutput(store, monaco);
    const outputDiv = renderResult.container.querySelector('.output');
    expect(outputDiv).toBeInTheDocument();
    expect(outputDiv).toHaveStyle('display: inline-block');
  });

  it('correctly sets the language', () => {
    const { instance } = renderOutput(store, monaco);
    expect(instance.language).toBe('consoleOutputLanguage');
  });

  describe('initMonaco()', () => {
    it('attempts to create an editor', async () => {
      const { instance } = renderOutput(store, monaco);

      instance.outputRef.current = 'ref' as any;
      await instance.initMonaco();

      expect(monaco.editor.create).toHaveBeenCalled();
      expect(monaco.editor.createModel).toHaveBeenCalled();
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const { instance } = renderOutput(store, monaco);

    instance.outputRef.current = 'ref' as any;
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(
      (monaco as unknown as MonacoMock).latestEditor.dispose,
    ).toHaveBeenCalled();
  });

  it('hides the console with react-mosaic-component', async () => {
    const { instance } = renderOutput(store, monaco);

    // direction is required to be recognized as a valid root node
    mockMosaicActions.getRoot.mockReturnValue({
      splitPercentage: 25,
      direction: 'row',
    });

    instance.outputRef.current = 'ref' as any;
    await instance.initMonaco();

    // Trigger toggleConsole explicitly
    instance.toggleConsole();

    expect(mockMosaicActions.replaceWith).toHaveBeenCalled();
    expect(mockMosaicActions.replaceWith).toHaveBeenCalledWith(
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

    const { instance } = renderOutput(store, monaco);

    instance.outputRef.current = 'ref' as any;
    await instance.initMonaco();
    (instance as any).updateModel();

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

    const { instance } = renderOutput(store, monaco);
    const spy = vi.spyOn(instance as any, 'updateModel');

    instance.outputRef.current = 'ref' as any;
    await instance.initMonaco();

    (instance as any).updateModel();

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
    const { instance } = renderOutput(store, monaco);
    const spy = vi.spyOn(instance, 'toggleConsole');

    instance.outputRef.current = 'ref' as any;
    await instance.initMonaco();

    await (instance as any).updateModel();
    expect(spy).toHaveBeenCalled();
  });
});
