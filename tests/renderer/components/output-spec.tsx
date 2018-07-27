import * as React from 'react';
import { shallow } from 'enzyme';

import { Output } from '../../../src/renderer/components/output';

describe('Outout component', () => {
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
    const wrapper = shallow(<Output appState={this.store} />);

    expect(wrapper).toMatchSnapshot();
  });
});
