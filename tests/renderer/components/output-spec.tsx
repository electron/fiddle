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
    ({ monaco } = (window as any).ElectronFiddle);
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

  describe('initMonaco()', () => {
    it('attempts to create an editor', async () => {
      const wrapper = shallow(
        <Output appState={store as any} monaco={monaco} monacoOptions={{}} />,
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
      <Output appState={store as any} monaco={monaco} monacoOptions={{}} />,
    );
    const instance: any = wrapper.instance();

    instance.outputRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(monaco.latestEditor.dispose).toHaveBeenCalled();
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
      <Output appState={store as any} monaco={monaco} monacoOptions={{}} />,
    );
    const instance: any = wrapper.instance();

    instance.outputRef.current = 'ref';
    await instance.initMonaco();
    instance.updateModel();

    expect(monaco.editor.createModel).toHaveBeenCalled();
    expect(instance.editor.revealLine).toHaveBeenCalled();
  });

  it('updateModel correctly observes and gets called when output is updated', async () => {
    store.output = [
      {
        timestamp: 1532704073130,
        text: 'Hi!',
      },
    ];

    const wrapper = shallow(
      <Output appState={store as any} monaco={monaco} monacoOptions={{}} />,
    );

    const instance: any = wrapper.instance();
    const spy = jest.spyOn(instance, 'updateModel');

    instance.outputRef.current = 'ref';
    await instance.initMonaco();

    instance.updateModel();

    // new output
    store.output = [
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
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('handles componentDidUpdate', async () => {
    // set up component
    const wrapper = shallow(
      <Output appState={store as any} monaco={monaco} monacoOptions={{}} />,
    );
    const instance: any = wrapper.instance();
    const spy = jest.spyOn(instance, 'toggleConsole');

    instance.outputRef.current = 'ref';
    await instance.initMonaco();

    // setContent will trigger componentDidUpdate()
    instance.editor.setContent(store.output);
    expect(spy).toHaveBeenCalled();
  });
});
