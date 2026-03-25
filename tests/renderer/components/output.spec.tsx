import type * as MonacoType from 'monaco-editor';
import type { MosaicContext } from 'react-mosaic-component';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Output } from '../../../src/renderer/components/output';
import { WrapperEditorId } from '../../../src/renderer/components/output-editors-wrapper';
import { AppState } from '../../../src/renderer/state';
import { MonacoMock } from '../../mocks/mocks';
import { renderClassComponentWithInstanceRef } from '../utils/renderClassComponentWithInstanceRef';

const mockContext = vi.hoisted(
  () =>
    ({
      mosaicActions: {
        expand: vi.fn(),
        remove: vi.fn(),
        hide: vi.fn(),
        replaceWith: vi.fn(),
        updateTree: vi.fn(),
        getRoot: vi.fn(),
      },
      mosaicId: 'output',
    }) as unknown as MosaicContext<WrapperEditorId>,
);

// Provide a default value for MosaicContext so that the component's
// `static contextType = MosaicContext` picks up `mockContext` without
// needing a Provider in the render tree.
vi.mock('react-mosaic-component', async () => {
  const React = await import('react');
  const actual = await vi.importActual<typeof import('react-mosaic-component')>(
    'react-mosaic-component',
  );

  return {
    ...actual,
    MosaicContext: React.createContext(mockContext),
  };
});

describe('Output component', () => {
  let store: AppState;
  let monaco: typeof MonacoType;

  beforeEach(() => {
    monaco = window.monaco;
    ({ state: store } = window.app);
    vi.mocked(mockContext.mosaicActions.replaceWith).mockClear();
    vi.mocked(mockContext.mosaicActions.getRoot).mockReset();
  });

  it('renders the output container', () => {
    const { renderResult } = renderClassComponentWithInstanceRef(Output, {
      appState: store,
      monaco,
      monacoOptions: {},
    });
    const outputDiv = renderResult.container.querySelector('.output');
    expect(outputDiv).toBeInTheDocument();
    expect(outputDiv).toHaveStyle('display: inline-block');
  });

  it('correctly sets the language', () => {
    const { instance } = renderClassComponentWithInstanceRef(Output, {
      appState: store,
      monaco,
      monacoOptions: {},
    });
    expect(instance.language).toBe('consoleOutputLanguage');
  });

  describe('initMonaco()', () => {
    it('attempts to create an editor', async () => {
      const { instance } = renderClassComponentWithInstanceRef(Output, {
        appState: store,
        monaco,
        monacoOptions: {},
      });

      // outputRef is private — cast needed to test initMonaco directly
      (instance as any).outputRef.current = 'ref';
      await instance.initMonaco();

      expect(monaco.editor.create).toHaveBeenCalled();
      expect(monaco.editor.createModel).toHaveBeenCalled();
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const { instance } = renderClassComponentWithInstanceRef(Output, {
      appState: store,
      monaco,
      monacoOptions: {},
    });

    // outputRef is private
    (instance as any).outputRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(
      (monaco as unknown as MonacoMock).latestEditor.dispose,
    ).toHaveBeenCalled();
  });

  it('hides the console with react-mosaic-component', async () => {
    // direction is required to be recognized as a valid root node
    vi.mocked(mockContext.mosaicActions.getRoot).mockReturnValue({
      splitPercentage: 25,
      direction: 'row',
    } as ReturnType<typeof mockContext.mosaicActions.getRoot>);

    const { instance } = renderClassComponentWithInstanceRef(Output, {
      appState: store,
      monaco,
      monacoOptions: {},
    });

    // outputRef is private
    (instance as any).outputRef.current = 'ref';
    await instance.initMonaco();
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

    const { instance } = renderClassComponentWithInstanceRef(Output, {
      appState: store,
      monaco,
      monacoOptions: {},
    });

    // outputRef and updateModel are private
    (instance as any).outputRef.current = 'ref';
    await instance.initMonaco();
    await (instance as any).updateModel();

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

    const { instance } = renderClassComponentWithInstanceRef(Output, {
      appState: store,
      monaco,
      monacoOptions: {},
    });
    // updateModel is private — cast needed to spy on it
    const spy = vi.spyOn(instance as any, 'updateModel');

    // outputRef is private
    (instance as any).outputRef.current = 'ref';
    await instance.initMonaco();

    await (instance as any).updateModel();

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
    const { instance } = renderClassComponentWithInstanceRef(Output, {
      appState: store,
      monaco,
      monacoOptions: {},
    });
    const spy = vi.spyOn(instance, 'toggleConsole');

    // outputRef and updateModel are private
    (instance as any).outputRef.current = 'ref';
    await instance.initMonaco();

    await (instance as any).updateModel();
    expect(spy).toHaveBeenCalled();
  });
});
