import * as React from 'react';

import { shallow } from 'enzyme';
import { describe, expect, it, vi } from 'vitest';

import { GeneralSettings } from '../../../src/renderer/components/settings-general';
import { AppState } from '../../../src/renderer/state';

const doNothingFunc = () => {
  // Do Nothing
};

vi.mock('../../../src/renderer/components/settings-general-github', () => ({
  GitHubSettings: 'settings-github',
}));

vi.mock('../../../src/renderer/components/settings-general-console', () => ({
  ConsoleSettings: 'settings-console',
}));

vi.mock('../../../src/renderer/components/settings-general-appearance', () => ({
  AppearanceSettings: 'settings-appearance',
}));

vi.mock(
  '../../../src/renderer/components/settings-general-block-accelerators',
  () => ({
    BlockAcceleratorsSettings: 'settings-block-accelerators',
  }),
);

vi.mock('../../../src/renderer/components/settings-general-gist', () => ({
  GistSettings: 'settings-gist',
}));

vi.mock('../../../src/renderer/components/settings-general-mirror', () => ({
  MirrorSettings: 'settings-general-mirror',
}));

describe('GeneralSettings component', () => {
  const store = {} as AppState;

  it('renders', () => {
    const wrapper = shallow(
      <GeneralSettings appState={store} toggleHasPopoverOpen={doNothingFunc} />,
    );

    expect(wrapper).toMatchSnapshot();
  });
});
