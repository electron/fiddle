import * as React from 'react';

import { shallow } from 'enzyme';

import { Header } from '../../../src/renderer/components/header';
import { AppState } from '../../../src/renderer/state';

jest.mock('../../../src/renderer/components/commands', () => ({
  Commands: 'commands',
}));

jest.mock('../../../src/renderer/components/output', () => ({
  Output: 'output',
}));

jest.mock('../../../src/renderer/components/tour-welcome', () => ({
  WelcomeTour: 'welcome-tour',
}));

describe('Header component', () => {
  const store = {} as AppState;

  it('renders', () => {
    const wrapper = shallow(<Header appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });
});
