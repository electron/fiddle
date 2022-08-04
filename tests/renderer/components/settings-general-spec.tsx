import * as React from 'react';

import { shallow } from 'enzyme';

import { GeneralSettings } from '../../../src/renderer/components/settings-general';

const doNothingFunc = () => {
  // Do Nothing
};

jest.mock('../../../src/renderer/components/settings-general-github', () => ({
  GitHubSettings: 'settings-github',
}));

jest.mock('../../../src/renderer/components/settings-general-console', () => ({
  ConsoleSettings: 'settings-console',
}));

jest.mock(
  '../../../src/renderer/components/settings-general-appearance',
  () => ({
    AppearanceSettings: 'settings-appearance',
  }),
);

jest.mock(
  '../../../src/renderer/components/settings-general-block-accelerators',
  () => ({
    BlockAcceleratorsSettings: 'settings-block-accelerators',
  }),
);

jest.mock(
  '../../../src/renderer/components/settings-general-package-author',
  () => ({
    PackageAuthorSettings: 'settings-package-author',
  }),
);

jest.mock('../../../src/renderer/components/settings-general-mirror', () => ({
  MirrorSettings: 'settings-general-mirror',
}));

describe('GeneralSettings component', () => {
  const store: any = {};

  it('renders', () => {
    const wrapper = shallow(
      <GeneralSettings appState={store} toggleHasPopoverOpen={doNothingFunc} />,
    );

    expect(wrapper).toMatchSnapshot();
  });
});
