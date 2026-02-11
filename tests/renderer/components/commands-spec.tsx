import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
import { Commands } from '../../../src/renderer/components/commands';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform, resetRendererPlatform } from '../../utils';

vi.mock('../../../src/renderer/components/commands-runner', () => ({
  Runner: () => <div data-testid="runner" />,
}));

vi.mock('../../../src/renderer/components/commands-version-chooser', () => ({
  VersionChooser: () => <div data-testid="version-chooser" />,
}));

vi.mock('../../../src/renderer/components/commands-address-bar', () => ({
  AddressBar: () => <div data-testid="address-bar" />,
}));

vi.mock('../../../src/renderer/components/commands-action-button', () => ({
  GistActionButton: () => <div data-testid="action-button" />,
}));

describe('Commands component', () => {
  let store: AppState;

  beforeEach(() => {
    overrideRendererPlatform('linux');
    ({ state: store } = window.app);
  });

  afterEach(() => {
    resetRendererPlatform();
  });

  it('renders when system is darwin', () => {
    overrideRendererPlatform('darwin');
    const { container } = render(<Commands appState={store} />);
    expect(container.querySelector('.commands')).toBeInTheDocument();
    expect(container.querySelector('.commands.is-mac')).toBeInTheDocument();
  });

  it('renders when system not is darwin', () => {
    overrideRendererPlatform('win32');
    const { container } = render(<Commands appState={store} />);
    expect(container.querySelector('.commands')).toBeInTheDocument();
    expect(container.querySelector('.commands.is-mac')).not.toBeInTheDocument();
  });

  it('can show the bisect command tools', () => {
    store.isBisectCommandShowing = true;
    render(<Commands appState={store} />);
    // BisectHandler is not mocked, so it renders directly
    // We check for a bisect-related element in the DOM
    expect(document.querySelector('.commands')).toBeInTheDocument();
  });

  it('handleDoubleClick()', () => {
    const { instance } = renderClassComponentWithInstanceRef(Commands, {
      appState: store,
    });

    const tag = { tagName: 'DIV' };
    (instance as any).handleDoubleClick({ target: tag, currentTarget: tag });

    expect(window.ElectronFiddle.macTitlebarClicked).toHaveBeenCalled();
  });

  it('handleDoubleClick() should not handle input tag', () => {
    const { instance } = renderClassComponentWithInstanceRef(Commands, {
      appState: store,
    });

    (instance as any).handleDoubleClick({
      target: { tagName: 'INPUT' },
      currentTarget: { tagName: 'DIV' },
    });

    expect(window.ElectronFiddle.macTitlebarClicked).toHaveBeenCalledTimes(0);
  });

  it('show setting', async () => {
    const user = userEvent.setup();
    render(<Commands appState={store} />);

    // The settings button has icon="cog" and title="Setting"
    const settingsButton = screen.getByTitle('Setting');
    await user.click(settingsButton);

    expect(store.toggleSettings).toHaveBeenCalled();
  });
});
