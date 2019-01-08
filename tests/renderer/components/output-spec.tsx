import { shallow } from 'enzyme';
import * as React from 'react';

import { Output } from '../../../src/renderer/components/output';

describe('Output component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      isConsoleShowing: true,
      output: []
    };
  });

  it('renders', () => {
    const wrapper = shallow(<Output appState={store} />);
    expect(wrapper.html()).toBe('<div class="output showing"></div>');
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

  it('hides the console via class', () => {
    store.isConsoleShowing = false;

    const wrapper = shallow(
      <Output appState={store} />
    );

    expect(wrapper.html().includes('showing')).toBe(false);
  });

  it('handles componentDidUpdate', () => {
    const wrapper = shallow(<Output appState={store} />);
    const instance: any = wrapper.instance() as any;

    instance.outputRef = { current: { scrollTop: 0, scrollHeight: 200 } };
    instance.componentDidUpdate();
    expect(instance.outputRef.current.scrollTop).toBe(200);
  });
});
