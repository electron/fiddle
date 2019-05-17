import { shallow } from 'enzyme';
import * as React from 'react';

import { ShowMe } from '../../../src/renderer/components/show-me';

describe('ShowMe component', () => {
  let mockState: any = {};

  beforeAll(() => {
    mockState = {};
  });

  it('renders', () => {
    const wrapper = shallow(<ShowMe appState={mockState} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders a template spec', () => {
    mockState.templateName = 'app';
    const wrapper = shallow(<ShowMe appState={mockState} />);
    expect(wrapper).toMatchSnapshot();
  });
});
