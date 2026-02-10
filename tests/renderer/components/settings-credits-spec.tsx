import * as React from 'react';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
import { CreditsSettings } from '../../../src/renderer/components/settings-credits';
import { AppState } from '../../../src/renderer/state';

describe('CreditsSettings component', () => {
  const mockContributors = [
    {
      url: 'https://github.com/felixrieseberg',
      api: 'https://api.github.com/users/felixrieseberg',
      login: 'felixrieseberg',
      avatar: 'https://avatars3.githubusercontent.com/u/1426799?v=4',
      name: 'Felix Rieseberg',
      bio: 'test bio',
      location: 'San Francisco',
    },
  ];

  const mockContributorsBroken = [
    {
      url: 'https://github.com/felixrieseberg',
      api: 'https://api.github.com/users/felixrieseberg',
      login: 'felixrieseberg',
      avatar: 'https://avatars3.githubusercontent.com/u/1426799?v=4',
      name: null,
      bio: null,
      location: null,
    },
  ];

  let store: AppState;

  beforeEach(() => {
    store = {} as AppState;
  });

  it('renders', async () => {
    const { instance, renderResult } = renderClassComponentWithInstanceRef(
      CreditsSettings,
      { appState: store },
    );
    act(() => {
      instance.setState({ contributors: mockContributors });
    });

    expect(screen.getByText('Credits')).toBeInTheDocument();
    expect(screen.getByText('Felix Rieseberg')).toBeInTheDocument();
    expect(
      screen.getByText('San Francisco', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText('test bio')).toBeInTheDocument();
  });

  it('renders for contributors with less data', async () => {
    const { instance } = renderClassComponentWithInstanceRef(CreditsSettings, {
      appState: store,
    });
    act(() => {
      instance.setState({ contributors: mockContributorsBroken });
    });

    expect(screen.getByText('Credits')).toBeInTheDocument();
    // When name is null, the login should be displayed instead
    expect(screen.getByText('felixrieseberg')).toBeInTheDocument();
  });

  it('renders nothing if we do not have contributors', async () => {
    const {
      instance,
      renderResult: { container },
    } = renderClassComponentWithInstanceRef(CreditsSettings, {
      appState: store,
    });
    act(() => {
      instance.setState({ contributors: [] });
    });

    expect(screen.getByText('Credits')).toBeInTheDocument();
    // No contributor cards should be rendered
    expect(container.querySelector('.contributor')).not.toBeInTheDocument();
  });

  it('handles a click', async () => {
    const { instance } = renderClassComponentWithInstanceRef(CreditsSettings, {
      appState: store,
    });
    act(() => {
      instance.setState({ contributors: mockContributors });
    });

    const user = userEvent.setup();
    const contributor = screen
      .getByText('Felix Rieseberg')
      .closest('.contributor')!;
    await user.click(contributor);
    expect(window.open).toHaveBeenCalled();
  });
});
