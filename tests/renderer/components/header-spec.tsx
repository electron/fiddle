import * as React from 'react';
import { shallow } from 'enzyme';

import { Header } from '../../../src/renderer/components/header';

jest.mock('../../../src/renderer/components/chrome-mac', () => ({
  ChromeMac: 'chrome-mac'
}));

jest.mock('../../../src/renderer/components/commands', () => ({
  Commands: 'commands'
}));

jest.mock('../../../src/renderer/components/output', () => ({
  Output: 'output'
}));

jest.mock('../../../src/renderer/components/tour-welcome', () => ({
  WelcomeTour: 'welcome-tour'
}));

describe('Header component', () => {
  beforeEach(() => {
    this.store = {};
  });

  it('renders', () => {
    const wrapper = shallow(<Header appState={this.store} />);
    expect(wrapper).toMatchSnapshot();
  });
});
