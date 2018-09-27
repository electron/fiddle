import { shallow } from 'enzyme';
import * as React from 'react';

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
  const store: any = {};

  it('renders', () => {
    const wrapper = shallow(<Header appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });
});
