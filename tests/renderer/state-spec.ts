import { ipcRendererManager } from '../../src/renderer/ipc';
import { AppState } from '../../src/renderer/state';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('electron', () => require('../mocks/electron'));
jest.mock('../../src/renderer/binary', () => ({
  BinaryManager: require('../mocks/binary').MockBinaryManager
}));
jest.mock('../../src/renderer/fetch-types', () => ({
  updateEditorTypeDefinitions: jest.fn()
}));
jest.mock('../../src/renderer/versions', () => ({
  getUpdatedKnownVersions: () => Promise.resolve(require('../mocks/electron-versions').mockVersionsArray),
  getKnownVersions: () => require('../mocks/electron-versions').mockVersionsArray
}));
jest.mock('../../src/utils/get-title', () => ({}));

describe('AppState', () => {
  let appState = new AppState();

  beforeEach(() => {
    appState = new AppState();
    ipcRendererManager.removeAllListeners();
  });

  it('exists', () => {
    expect(appState).toBeTruthy();
  });

  describe('getName()', () => {
    it('returns the name', async () => {
      (appState as any).name = 'hi';
      expect(await appState.getName()).toBe('hi');
    });
  });

  describe('toggleConsole()', () => {
    it('toggles the console', () => {
      appState.toggleConsole();
      expect(appState.isConsoleShowing).toBe(true);
      appState.toggleConsole();
      expect(appState.isConsoleShowing).toBe(false);
    });
  });

  describe('toggleAuthDialog()', () => {
    it('toggles the token dialog', () => {
      appState.toggleAuthDialog();
      expect(appState.isTokenDialogShowing).toBe(true);
      appState.toggleAuthDialog();
      expect(appState.isTokenDialogShowing).toBe(false);
    });
  });

  describe('toggleSettings()', () => {
    it('toggles the settings page', () => {
      appState.toggleSettings();
      expect(appState.isSettingsShowing).toBe(true);
      appState.toggleSettings();
      expect(appState.isSettingsShowing).toBe(false);
    });
  });

  describe('disableTour()', () => {
    it('disables the tour', () => {
      appState.isTourShowing = false;
      appState.disableTour();
      expect(appState.isTourShowing).toBe(false);
    });
  });

  describe('showTour()', () => {
    it('shows the tour', () => {
      appState.isTourShowing = true;
      appState.showTour();
      expect(appState.isTourShowing).toBe(true);
    });
  });

  describe('removeVersion()', () => {
    it('removes a version', async () => {
      appState.versions['2.0.2'].state = 'ready';
      await appState.removeVersion('v2.0.2');

      expect(appState.binaryManager.remove).toHaveBeenCalledWith('2.0.2');
    });

    it('does not remove it if not necessary', async () => {
      await appState.removeVersion('v2.0.2');
      expect(appState.binaryManager.remove).toHaveBeenCalledTimes(0);
    });

    it('does not remove it if not necessary (version not existent)', async () => {
      appState.versions['2.0.2'] = undefined;
      await appState.removeVersion('v2.0.2');
      expect(appState.binaryManager.remove).toHaveBeenCalledTimes(0);
    });
  });

  describe('downloadVersion()', () => {
    it('downloads a version', async () => {
      await appState.downloadVersion('v2.0.2');
      expect(appState.binaryManager.setup).toHaveBeenCalledWith('2.0.2');
    });

    it('downloads an unknown version', async () => {
      await appState.downloadVersion('v3.5');
      expect(appState.binaryManager.setup).toHaveBeenCalledWith('3.5');
    });

    it('does not download a version if already ready', async () => {
      appState.versions['2.0.2'].state = 'ready';

      await appState.downloadVersion('v2.0.2');
      expect(appState.binaryManager.setup).toHaveBeenCalledTimes(0);
    });
  });

  describe('setVersion()', () => {
    it('downloads a version if necessary', async () => {
      appState.downloadVersion = jest.fn();
      await appState.setVersion('v2.0.2');

      expect(appState.downloadVersion).toHaveBeenCalled();
    });
  });

  describe('updateDownloadedVersionState()', () => {
    it('downloads a version if necessary', async () => {
      const mockResult = Promise.resolve(['2.0.2']);
      (appState.binaryManager.getDownloadedVersions as any).mockReturnValueOnce(mockResult);
      await appState.updateDownloadedVersionState();

      expect(appState.versions['2.0.2'].state).toBe('ready');
    });
  });

  describe('signOutGitHub()', () => {
    it('resets all GitHub information', () => {
      appState.gitHubAvatarUrl = 'test';
      appState.gitHubLogin = 'test';
      appState.gitHubToken = 'test';
      appState.gitHubName = 'test';

      appState.signOutGitHub();
      expect(appState.gitHubAvatarUrl).toBe(null);
      expect(appState.gitHubLogin).toBe(null);
      expect(appState.gitHubToken).toBe(null);
      expect(appState.gitHubName).toBe(null);
    });
  });

  describe('pushOutput()', () => {
    it('takes a fancy buffer and turns it into output', () => {
      appState.pushOutput(Buffer.from('hi'));

      expect(appState.output[0].text).toBe('hi');
      expect(appState.output[0].timestamp).toBeTruthy();
    });

    it('ignores the "Debuggeer listening on..." output', () => {
      appState.pushOutput('Debugger listening on ws://localhost:123');
      expect(appState.output.length).toBe(0);
    });

    it('ignores the "For help see..." output', () => {
      appState.pushOutput('For help see https://nodejs.org/en/docs/inspector');
      expect(appState.output.length).toBe(0);
    });

    it('handles a complex buffer on Win32', () => {
      overridePlatform('win32');

      appState.pushOutput(Buffer.from('Buffer\r\nStuff'), false);
      expect(appState.output[0].text).toBe('Buffer');

      resetPlatform();
    });
  });

  describe('pushError()', () => {
    it('pushes an error', () => {
      appState.pushError('Bwap bwap', new Error('Bwap bwap'));

      expect(appState.output[0].text).toBe('⚠️ Bwap bwap. Error encountered:');
      expect(appState.output[1].text).toBe('Error: Bwap bwap');
    });
  });
});
