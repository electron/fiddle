import * as React from 'react';

import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ElectronReleaseChannel,
  GenericDialogType,
  InstallState,
  VersionSource,
} from '../../src/interfaces';
import { Dialogs } from '../../src/renderer/components/dialogs';
import { AppState } from '../../src/renderer/state';
import { StateMock } from '../../tests/mocks/mocks';
import { overrideRendererPlatform } from '../../tests/utils';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

// Mock the Settings component to avoid complex dependencies
vi.mock('../../src/renderer/components/settings', () => ({
  Settings: () =>
    React.createElement('div', { 'data-testid': 'settings-mock' }, 'Settings'),
}));

describe('Dialogs component', () => {
  let store: AppState;

  const generateVersionRange = (rangeLength: number) =>
    new Array(rangeLength).fill(0).map((_, i) => ({
      state: InstallState.installed,
      version: `${i + 1}.0.0`,
      source: VersionSource.local,
    }));

  beforeEach(() => {
    overrideRendererPlatform('darwin');
    ({ state: store } = window.app);

    // Reset all dialog flags
    store.isTokenDialogShowing = false;
    store.isSettingsShowing = false;
    store.isAddVersionDialogShowing = false;
    store.isThemeDialogShowing = false;
    store.isBisectDialogShowing = false;
    store.isGenericDialogShowing = false;

    // Setup generic dialog options for when it's shown
    store.genericDialogOptions = {
      type: GenericDialogType.confirm,
      ok: 'OK',
      cancel: 'Cancel',
      label: 'Test label',
    };

    // Setup versions needed by BisectDialog
    const versions = generateVersionRange(10);
    (store as unknown as StateMock).versionsToShow = versions;
    (store as unknown as StateMock).versions = Object.fromEntries(
      versions.map((ver) => [ver.version, ver]),
    );
    (store as unknown as StateMock).channelsToShow = [
      ElectronReleaseChannel.stable,
    ];
  });

  function renderDialogs() {
    return renderClassComponentWithInstanceRef(Dialogs, {
      appState: store,
    });
  }

  it('renders the container div', () => {
    const { renderResult } = renderDialogs();

    const container = renderResult.container.querySelector('.dialogs');
    expect(container).toBeInTheDocument();
  });

  it('renders the token dialog when isTokenDialogShowing is true', () => {
    store.isTokenDialogShowing = true;
    renderDialogs();

    expect(screen.getByText('GitHub Token')).toBeInTheDocument();
  });

  it('does not render token dialog when isTokenDialogShowing is false', () => {
    store.isTokenDialogShowing = false;
    renderDialogs();

    expect(screen.queryByText('GitHub Token')).not.toBeInTheDocument();
  });

  it('renders the settings dialog when isSettingsShowing is true', () => {
    store.isSettingsShowing = true;
    renderDialogs();

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('does not render settings dialog when isSettingsShowing is false', () => {
    store.isSettingsShowing = false;
    renderDialogs();

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders the add version dialog when isAddVersionDialogShowing is true', () => {
    store.isAddVersionDialogShowing = true;
    renderDialogs();

    expect(screen.getByText('Add local Electron build')).toBeInTheDocument();
  });

  it('does not render add version dialog when isAddVersionDialogShowing is false', () => {
    store.isAddVersionDialogShowing = false;
    renderDialogs();

    expect(
      screen.queryByText('Add local Electron build'),
    ).not.toBeInTheDocument();
  });

  it('renders the add theme dialog when isThemeDialogShowing is true', () => {
    store.isThemeDialogShowing = true;
    renderDialogs();

    expect(screen.getByText('Add theme')).toBeInTheDocument();
  });

  it('does not render add theme dialog when isThemeDialogShowing is false', () => {
    store.isThemeDialogShowing = false;
    renderDialogs();

    expect(screen.queryByText('Add theme')).not.toBeInTheDocument();
  });

  it('renders the bisect dialog when isBisectDialogShowing is true', () => {
    store.isBisectDialogShowing = true;
    renderDialogs();

    expect(screen.getByText('Start a bisect session')).toBeInTheDocument();
  });

  it('does not render bisect dialog when isBisectDialogShowing is false', () => {
    store.isBisectDialogShowing = false;
    renderDialogs();

    expect(
      screen.queryByText('Start a bisect session'),
    ).not.toBeInTheDocument();
  });

  it('renders the generic dialog when isGenericDialogShowing is true', () => {
    store.isGenericDialogShowing = true;
    renderDialogs();

    expect(screen.getByText('Test label')).toBeInTheDocument();
  });

  it('does not render generic dialog when isGenericDialogShowing is false', () => {
    store.isGenericDialogShowing = false;
    renderDialogs();

    expect(screen.queryByText('Test label')).not.toBeInTheDocument();
  });

  it('can render multiple dialogs simultaneously', () => {
    store.isTokenDialogShowing = true;
    store.isGenericDialogShowing = true;
    renderDialogs();

    expect(screen.getByText('GitHub Token')).toBeInTheDocument();
    expect(screen.getByText('Test label')).toBeInTheDocument();
  });
});
