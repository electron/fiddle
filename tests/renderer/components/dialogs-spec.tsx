import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Dialogs } from '../../../src/renderer/components/dialogs';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform } from '../../utils';

describe('Dialogs component', () => {
  let store: AppState;

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
    store.isGenericDialogShowing = true;

    // Settings component's AppearanceSettings calls getAvailableThemes().then()
    // in its constructor, so we need to mock it to return a resolved promise
    vi.mocked(window.ElectronFiddle.getAvailableThemes).mockResolvedValue([]);
  });

  it('renders the token dialog', () => {
    store.isTokenDialogShowing = true;
    render(<Dialogs appState={store} />);
    // TokenDialog renders a Dialog with title "GitHub Token"
    expect(screen.getByText('GitHub Token')).toBeInTheDocument();
  });

  it('renders the settings dialog', () => {
    store.isSettingsShowing = true;
    render(<Dialogs appState={store} />);
    // Verify the Settings component actually renders (not just the container)
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Electron')).toBeInTheDocument();
  });

  it('renders the add version dialog', () => {
    store.isAddVersionDialogShowing = true;
    render(<Dialogs appState={store} />);
    // AddVersionDialog renders a Dialog with title "Add local Electron build"
    expect(screen.getByText('Add local Electron build')).toBeInTheDocument();
  });
});
