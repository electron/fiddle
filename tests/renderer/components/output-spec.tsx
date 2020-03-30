import { shallow } from 'enzyme';
import * as React from 'react';

import { Output } from '../../../src/renderer/components/output';
import { MockState } from '../../mocks/state';

let mockContext: any = {};

jest.mock('react-mosaic-component', () => {
  const { MosaicContext, MosaicRootActions } = jest.requireActual('react-mosaic-component');

  return {
    MosaicContext,
    MosaicRootActions
  };
});

beforeAll(() => {
  mockContext = {
    mosaicActions: {
      expand: jest.fn(),
      remove: jest.fn(),
      hide: jest.fn(),
      replaceWith: jest.fn(),
      updateTree: jest.fn(),
      getRoot: jest.fn()
    },
    mosaicId: 'output'
  };
});

describe('Output component', () => {
  let store: any;

  beforeEach(() => {
    store = new MockState();
  });

  it('renders', () => {
    const wrapper = shallow(<Output appState={store} />);
    expect(wrapper.html()).toBe('<div class="output"></div>');
  });

  it('renders with output', () => {
    store.output = [
      {
        timestamp: 1532704072127,
        text: 'Hello!'
      },
      {
        timestamp: 1532704073130,
        text: 'Hi!'
      },
      {
        timestamp: 1532704073130,
        text: 'Hi!',
        isNotPre: true
      }
    ];

    const renderTimestamp = (i: number) => i.toString();
    const wrapper = shallow(
      <Output appState={store} renderTimestamp={renderTimestamp} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('calculates a timestamp', () => {
    const wrapper = shallow(<Output appState={store} />);
    const instance: Output = wrapper.instance() as any;

    const result = instance.renderTimestamp(1546834508111);

    // Depends on the server, we just want to verify that we
    // get _something_
    expect(result).toBeTruthy();
  });

  it('hides the console with react-mosaic-component', () => {
    // manually trigger lifecycle methods so that
    // context can be set before mounting method
    const wrapper = shallow(<Output appState={store} />, {
      context: mockContext,
      disableLifecycleMethods: true
    });

    wrapper.instance().context = mockContext;
    wrapper.instance().componentDidMount!();

    expect(mockContext.mosaicActions.expand).toHaveBeenCalledWith(['first'], 25);

    store.isConsoleShowing = false;

    // Todo: There's a scary bug here in Jest / Enzyme. At this point in time,
    // the context is {}. That's never the case in production.
    // expect(mockContext.mosaicActions.expand).toHaveBeenCalledWith(['first'], 0);
    expect(wrapper.html()).toBe(null);
  });

  it('handles componentDidUpdate', () => {
    const wrapper = shallow(<Output appState={store} />);
    const instance: any = wrapper.instance() as any;

    instance.outputRef = { current: { scrollTop: 0, scrollHeight: 200 } };
    instance.componentDidUpdate();
    expect(instance.outputRef.current.scrollTop).toBe(200);
  });
});
