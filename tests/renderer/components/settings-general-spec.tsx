import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GeneralSettings } from '../../../src/renderer/components/settings-general';
import { AppState } from '../../../src/renderer/state';

const doNothingFunc = () => {
  // Do Nothing
};

vi.mock('../../../src/renderer/components/settings-general-github', () => ({
  GitHubSettings: () => <div data-testid="settings-github" />,
}));

vi.mock('../../../src/renderer/components/settings-general-console', () => ({
  ConsoleSettings: () => <div data-testid="settings-console" />,
}));

vi.mock('../../../src/renderer/components/settings-general-appearance', () => ({
  AppearanceSettings: () => <div data-testid="settings-appearance" />,
}));

vi.mock(
  '../../../src/renderer/components/settings-general-block-accelerators',
  () => ({
    BlockAcceleratorsSettings: () => (
      <div data-testid="settings-block-accelerators" />
    ),
  }),
);

vi.mock('../../../src/renderer/components/settings-general-gist', () => ({
  GistSettings: () => <div data-testid="settings-gist" />,
}));

vi.mock('../../../src/renderer/components/settings-general-mirror', () => ({
  MirrorSettings: () => <div data-testid="settings-general-mirror" />,
}));

vi.mock('../../../src/renderer/components/settings-general-font', () => ({
  FontSettings: () => <div data-testid="settings-font" />,
}));

describe('GeneralSettings component', () => {
  const store = {} as AppState;

  it('renders', () => {
    render(
      <GeneralSettings appState={store} toggleHasPopoverOpen={doNothingFunc} />,
    );

    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByTestId('settings-github')).toBeInTheDocument();
    expect(screen.getByTestId('settings-console')).toBeInTheDocument();
    expect(screen.getByTestId('settings-appearance')).toBeInTheDocument();
    expect(
      screen.getByTestId('settings-block-accelerators'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('settings-gist')).toBeInTheDocument();
    expect(screen.getByTestId('settings-general-mirror')).toBeInTheDocument();
    expect(screen.getByTestId('settings-font')).toBeInTheDocument();
  });
});
