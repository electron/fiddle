import * as React from 'react';
import { shallow } from 'enzyme';

import { CreditsSettings } from '../../../src/renderer/components/settings-credits';

describe('CreditsSettings component', () => {
  const mockContributors = [
    {
      url: 'https://github.com/felixrieseberg',
      api: 'https://api.github.com/users/felixrieseberg',
      login: 'felixrieseberg',
      avatar: 'https://avatars3.githubusercontent.com/u/1426799?v=4',
      name: 'Felix Rieseberg',
      bio: '🙇 ✨🌳 ',
      location: 'San Francisco'
    }
  ];

  beforeEach(() => {
    this.store = {};
  });

  it('renders', () => {
    const wrapper = shallow(
      <CreditsSettings appState={this.store} contributors={mockContributors} />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
