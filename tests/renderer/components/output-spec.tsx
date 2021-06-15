import { shallow } from 'enzyme';
import * as React from 'react';

import { Output } from '../../../src/renderer/components/output';
import { StateMock } from '../../mocks/state';

const mockContext = {
  mosaicActions: {
    expand: jest.fn(),
    remove: jest.fn(),
    hide: jest.fn(),
    replaceWith: jest.fn(),
    updateTree: jest.fn(),
    getRoot: jest.fn(),
  },
  mosaicId: 'output',
};

describe('Output component', () => {
  let store: any;
  let monaco: any;

  beforeEach(() => {
    store = new StateMock();
    ({ monaco } = (window as any).ElectronFiddle.app);
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
      <Output appState={store as any} monaco={monaco} monacoOptions={{}} />,
    );

    expect((wrapper.instance() as any).language).toBe('consoleOutputLanguage');
  });

  describe('initMonaco()', async () => {
    it('attempts to create an editor', async () => {
      const didMount = jest.fn();
      const wrapper = shallow(
        <Output
          appState={store as any}
          monaco={monaco}
          monacoOptions={{}}
          editorDidMount={didMount}
        />,
      );
      const instance: any = wrapper.instance();

      instance.outputRef.current = 'ref';
      await instance.initMonaco();

      expect(didMount).toHaveBeenCalled();
      expect(monaco.editor.create).toHaveBeenCalled();
      expect(monaco.editor.createModel).toHaveBeenCalled();
    });

    it('initializes with a fixed tab size', async () => {
      const didMount = jest.fn();
      const wrapper = shallow(
        <Output
          appState={store as any}
          monaco={monaco}
          monacoOptions={{}}
          editorDidMount={didMount}
        />,
      );
      const instance: any = wrapper.instance();

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(monaco.latestModel.updateOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          tabSize: 2,
        }),
      );
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const didMount = jest.fn();
    const wrapper = shallow(
      <Output
        appState={store as any}
        monaco={monaco}
        monacoOptions={{}}
        editorDidMount={didMount}
      />,
    );
    const instance: any = wrapper.instance();

    instance.containerRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(monaco.latestEditor.dispose).toHaveBeenCalled();
  });

  it('hides the console with react-mosaic-component', () => {
    // manually trigger lifecycle methods so that
    // context can be set before mounting method
    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
      {
        context: mockContext,
        disableLifecycleMethods: true,
      },
    );

    mockContext.mosaicActions.getRoot.mockReturnValue({
      direction: 'row',
      first: 'output',
      second: 'editors',
    });

    wrapper.instance().context = mockContext;
    wrapper.instance().componentDidMount!();

    expect(mockContext.mosaicActions.replaceWith).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ splitPercentage: 25 }),
    );
    expect(wrapper.html()).not.toBe(null);

    store.isConsoleShowing = false;

    // Todo: There's a scary bug here in Jest / Enzyme. At this point in time,
    // the context is {}. That's never the case in production.
    // expect(mockContext.mosaicActions.expand).toHaveBeenCalledWith(['first'], 0);
    expect(wrapper.html()).toBe(null);
  });

  it('handles componentDidUpdate', async () => {
    store.output = [
      {
        timestamp: 1532704072127,
        text: 'Hello!',
      },
      {
        timestamp: 1532704073130,
        text: 'Hi!',
      },
      {
        timestamp: 1532704073130,
        text: 'Hi!',
        isNotPre: true,
      },
    ];

    const wrapper = shallow(
      <Output appState={store} monaco={monaco} monacoOptions={{}} />,
    );
    const instance: any = wrapper.instance() as any;

    instance.outputRef = React.createRef<HTMLDivElement>();
    await instance.initMonaco();

    instance.componentDidUpdate();
    expect(instance.editor.getScrollTop()).toBe(3);
  });
});
