import { shallow } from 'enzyme';
import * as React from 'react';

import { Output } from '../../../src/renderer/components/output';

describe('Output component', () => {
  beforeEach(() => {
    this.store = {
      isConsoleShowing: true,
      output: []
    };
  });

  it('renders', () => {
    const wrapper = shallow(<Output appState={this.store} />);
    expect(wrapper.html()).toBe('<div class="output showing"></div>');
  });

  it('renders with output', () => {
    this.store.output = [
      {
        timestamp: 1532704072127,
        text: 'Hello!'
      },
      {
        timestamp: 1532704073130,
        text: 'Hi!'
      }
    ];

    const renderTimestamp = (i: number) => i.toString();
    const wrapper = shallow(
      <Output appState={this.store} renderTimestamp={renderTimestamp} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('hides the console via class', () => {
    this.store.isConsoleShowing = false;

    const wrapper = shallow(
      <Output appState={this.store} />
    );

    expect(wrapper.html().includes('showing')).toBe(false);
  });

  it('handles componentDidUpdate', () => {
    const wrapper = shallow(<Output appState={this.store} />);
    const instance: any = wrapper.instance() as any;

    instance.outputRef = { current: { scrollTop: 0, scrollHeight: 200 } };
    instance.componentDidUpdate();
    expect(instance.outputRef.current.scrollTop).toBe(200);
  });
});
