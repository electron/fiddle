import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InstallState } from '../../src/interfaces';
import { Runner } from '../../src/renderer/components/commands-runner';
import { AppState } from '../../src/renderer/state';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

vi.mock('../../src/renderer/file-manager');

describe('Runner component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('is runnable when Electron is installed', () => {
    store.currentElectronVersion.state = InstallState.installed;
    const { renderResult } = renderClassComponentWithInstanceRef(Runner, {
      appState: store,
    });

    const button = renderResult.getByRole('button', { name: /run/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button.textContent).toContain('Run');
  });

  it('can be stopped if Fiddle is running', () => {
    store.currentElectronVersion.state = InstallState.installed;
    store.isRunning = true;
    const { renderResult } = renderClassComponentWithInstanceRef(Runner, {
      appState: store,
    });

    const button = renderResult.getByRole('button', { name: /stop/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button.textContent).toContain('Stop');
    expect(button).toHaveClass('bp3-active');
  });

  it('disables the button when installing modules', () => {
    store.currentElectronVersion.state = InstallState.installed;
    store.isInstallingModules = true;
    const { renderResult } = renderClassComponentWithInstanceRef(Runner, {
      appState: store,
    });

    const button = renderResult.getByRole('button', {
      name: /installing modules/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button.textContent).toContain('Installing modules');
  });

  it('disables the button when downloading Electron', () => {
    store.currentElectronVersion.state = InstallState.downloading;
    store.currentElectronVersion.downloadProgress = 50;
    const { renderResult } = renderClassComponentWithInstanceRef(Runner, {
      appState: store,
    });

    const button = renderResult.getByRole('button', { name: /downloading/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button.textContent).toContain('Downloading');
  });

  it('disables the button when unzipping Electron', () => {
    store.currentElectronVersion.state = InstallState.installing;
    const { renderResult } = renderClassComponentWithInstanceRef(Runner, {
      appState: store,
    });

    const button = renderResult.getByRole('button', { name: /unzipping/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button.textContent).toContain('Unzipping');
  });

  it('disables the button when Electron is missing', () => {
    store.currentElectronVersion.state = InstallState.missing;
    const { renderResult } = renderClassComponentWithInstanceRef(Runner, {
      appState: store,
    });

    const button = renderResult.getByRole('button', {
      name: /checking status/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button.textContent).toContain('Checking status');
  });
});
