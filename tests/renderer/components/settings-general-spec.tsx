import { shallow } from 'enzyme';
import * as React from 'react';

import { GeneralSettings } from '../../../src/renderer/components/settings-general';

jest.mock('../../../src/renderer/components/settings-general-github', () => ({
  GitHubSettings: 'settings-github'
}));

jest.mock('../../../src/renderer/components/settings-general-appearance', () => ({
  AppearanceSettings: 'settings-appearance'
}));

describe('GeneralSettings component', () => {
  beforeEach(() => {
    this.store = {};
  });

  it('renders', () => {
    const wrapper = shallow(
      <GeneralSettings appState={this.store} />
    );

    expect(wrapper).toMatchSnapshot();
  });
});
