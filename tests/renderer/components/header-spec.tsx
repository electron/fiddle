import * as React from 'react';

import { shallow } from 'enzyme';
import { describe, expect, it, vi } from 'vitest';

import { Header } from '../../../src/renderer/components/header';
import { AppState } from '../../../src/renderer/state';

vi.mock('../..//src/renderer/components/commands', () => ({
  Commands: 'commands',
}));

vi.mock('../../../src/renderer/components/output', () => ({
  Output: 'output',
}));

vi.mock('../../../src/renderer/components/tour-welcome', () => ({
  WelcomeTour: 'welcome-tour',
}));

describe('Header component', () => {
  const store = {} as AppState;

  it('renders', () => {
    const wrapper = shallow(<Header appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });
});
