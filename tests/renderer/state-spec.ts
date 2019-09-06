import { ALL_MOSAICS, EditorId, ElectronVersionSource, ElectronVersionState, PanelId } from '../../src/interfaces';
import { Bisector } from '../../src/renderer/bisect';
import { DEFAULT_MOSAIC_ARRANGEMENT } from '../../src/renderer/constants';
import { getContent, isContentUnchanged } from '../../src/renderer/content';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { AppState } from '../../src/renderer/state';
import { getUpdatedElectronVersions, saveLocalVersions } from '../../src/renderer/versions';
import { createMosaicArrangement } from '../../src/utils/editors-mosaic-arrangement';
import { getName } from '../../src/utils/get-title';
import { mockVersions } from '../mocks/electron-versions';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/renderer/content', () => ({
  isContentUnchanged: jest.fn(),
  getContent: jest.fn()
}));
jest.mock('../../src/renderer/binary', () => ({
  BinaryManager: require('../mocks/binary').MockBinaryManager
}));
jest.mock('../../src/renderer/fetch-types', () => ({
  updateEditorTypeDefinitions: jest.fn()
}));
jest.mock('../../src/renderer/versions', () => ({
  getUpdatedElectronVersions: jest.fn().mockImplementation(async () => {
    return require('../mocks/electron-versions').mockVersionsArray;
  }),
  getElectronVersions: () => require('../mocks/electron-versions').mockVersionsArray,
  getDefaultVersion: () => '2.0.2',
  ElectronReleaseChannel: {
    stable: 'Stable',
    beta: 'Beta'
  },
  addLocalVersion: jest.fn(),
  saveLocalVersions: jest.fn()
}));
jest.mock('../../src/utils/get-title', () => ({
  getName: jest.fn()
}));

describe('AppState', () => {
  let appState = new AppState();

  beforeEach(() => {
    appState = new AppState();
    ipcRendererManager.removeAllListeners();
  });

  it('exists', () => {
    expect(appState).toBeTruthy();
  });

  describe('onbeforeunload handler', () => {
    it('closes the window', (done) => {
      window.close = jest.fn();
      appState.isUnsaved = true;
      expect(window.onbeforeunload).toBeTruthy();

      const result = window.onbeforeunload!(undefined as any);
      expect(result).toBe(false);
      expect(appState.isWarningDialogShowing).toBe(true);

      appState.warningDialogLastResult = true;
      appState.isWarningDialogShowing = false;
      process.nextTick(() => {
        expect(window.close).toHaveBeenCalled();
        done();
      });
    });

    it('closes the app', (done) => {
      const { remote } = require('electron');
      window.close = jest.fn();
      appState.isUnsaved = true;
      (remote.getGlobal as jest.Mock).mockReturnValueOnce(true);
      expect(window.onbeforeunload).toBeTruthy();

      const result = window.onbeforeunload!(undefined as any);
      expect(result).toBe(false);
      expect(appState.isWarningDialogShowing).toBe(true);

      appState.warningDialogLastResult = true;
      appState.isWarningDialogShowing = false;
      process.nextTick(() => {
        expect(window.close).toHaveBeenCalledTimes(0);
        expect(remote.app.quit).toHaveBeenCalledTimes(1);
        done();
      });
    });

    it('does not close the window', (done) => {
      window.close = jest.fn();
      appState.isUnsaved = true;
      expect(window.onbeforeunload).toBeTruthy();

      const result = window.onbeforeunload!(undefined as any);
      expect(result).toBe(false);
      expect(appState.isWarningDialogShowing).toBe(true);

      appState.warningDialogLastResult = false;
      appState.isWarningDialogShowing = false;
      process.nextTick(() => {
        expect(window.close).toHaveBeenCalledTimes(0);
        done();
      });
    });
  });

  describe('updateElectronVersions()', () => {
    it('handles errors gracefully', async () => {
      (getUpdatedElectronVersions as jest.Mock)
        .mockImplementationOnce(async () => {
          throw new Error('Bwap-bwap');
        });

      await appState.updateDownloadedVersionState();
    });
  });

  describe('getName()', () => {
    it('returns the name', async () => {
      (appState as any).name = 'hi';
      expect(await appState.getName()).toBe('hi');
    });

    it('returns the name, even if none exists', async () => {
      (getName as jest.Mock).mockReturnValue('test');
      (appState as any).name = undefined;
      expect(await appState.getName()).toBe('test');
    });
  });

  describe('get currentElectronVersion()', () => {
    it('returns the current version', () => {
      appState.version = '2.0.2';
      appState.versions = mockVersions;

      expect(appState.currentElectronVersion).toEqual(mockVersions['2.0.2']);
    });

    it('falls back to the defaultVersion', () => {
      appState.version = 'garbage';
      appState.versions = mockVersions;

      expect(appState.currentElectronVersion).toEqual(mockVersions['2.0.2']);
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

  describe('clearConsole()', () => {
    it('clears the console', () => {
      expect(appState.output.length).toBe(1);
      appState.clearConsole();
      expect(appState.output.length).toBe(0);
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

  describe('toggleBisectCommands()', () => {
    it('toggles visibility of the bisect commands', () => {
      const isVisible = appState.isBisectCommandShowing;
      appState.toggleBisectCommands();
      expect(isVisible).not.toBe(appState.isBisectCommandShowing);
    });

    it('takes no action if bisect dialog is active', () => {
      const isVisible = appState.isBisectCommandShowing;

      expect(appState.isBisectDialogShowing).toBe(false);
      appState.toggleBisectDialog();

      appState.toggleBisectCommands();
      expect(isVisible).toBe(appState.isBisectCommandShowing);
    });

    it('takes no action if bisect instance is active', () => {
      const isVisible = appState.isBisectCommandShowing;

      appState.Bisector = new Bisector([]);

      appState.toggleBisectCommands();
      expect(isVisible).toBe(appState.isBisectCommandShowing);
    });
  });

  describe('toggleAddVersionDialog()', () => {
    it('toggles the add version dialog', () => {
      appState.toggleAddVersionDialog();
      expect(appState.isAddVersionDialogShowing).toBe(true);
      appState.toggleAddVersionDialog();
      expect(appState.isAddVersionDialogShowing).toBe(false);
    });
  });

  describe('toggleWarningDialog()', () => {
    it('toggles the warnign dialog', () => {
      appState.warningDialogLastResult = true;

      appState.toggleWarningDialog();
      expect(appState.isWarningDialogShowing).toBe(true);
      expect(appState.warningDialogLastResult).toBe(null);

      appState.toggleWarningDialog();
      expect(appState.isWarningDialogShowing).toBe(false);
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
      appState.versions['2.0.2'].state = ElectronVersionState.ready;
      await appState.removeVersion('v2.0.2');

      expect(appState.binaryManager.remove).toHaveBeenCalledWith('2.0.2');
    });

    it('does not remove it if not necessary', async () => {
      appState.versions['2.0.2'].state = ElectronVersionState.unknown;
      await appState.removeVersion('v2.0.2');
      expect(appState.binaryManager.remove).toHaveBeenCalledTimes(0);
    });

    it('does not remove it if not necessary (version not existent)', async () => {
      appState.versions['2.0.2'] = undefined as any;
      await appState.removeVersion('v2.0.2');
      expect(appState.binaryManager.remove).toHaveBeenCalledTimes(0);
    });

    it('removes (and not deletes) a local version', async () => {
      appState.versions['/local/path'] = {
        localPath: 'local/path',
        name: 'local-foo',
        source: ElectronVersionSource.local,
        state: ElectronVersionState.ready,
        version: '4.0.0'
      };

      await appState.removeVersion('/local/path');

      expect(saveLocalVersions).toHaveBeenCalledTimes(1);
      expect(appState.versions['/local/path']).toBeUndefined();
      expect(appState.binaryManager.remove).toHaveBeenCalledTimes(0);
    });
  });

  describe('downloadVersion()', () => {
    it('downloads a version', async () => {
      appState.versions['2.0.2'].state = ElectronVersionState.unknown;

      await appState.downloadVersion('v2.0.2');
      expect(appState.binaryManager.setup).toHaveBeenCalledWith('2.0.2');
    });

    it('downloads an unknown version', async () => {
      await appState.downloadVersion('v3.5');
      expect(appState.binaryManager.setup).toHaveBeenCalledWith('3.5');
    });

    it('does not download a version if already ready', async () => {
      appState.versions['2.0.2'].state = ElectronVersionState.ready;

      await appState.downloadVersion('v2.0.2');
      expect(appState.binaryManager.setup).toHaveBeenCalledTimes(0);
    });
  });

  describe('setVersion()', () => {
    it('falls back if a version does not exist', async () => {
      await appState.setVersion('v999.99.99');

      expect(appState.version).toBe('2.0.2');
    });

    it('downloads a version if necessary', async () => {
      appState.downloadVersion = jest.fn();
      await appState.setVersion('v2.0.2');

      expect(appState.downloadVersion).toHaveBeenCalled();
    });

    it('possibly updates the editors', async () => {
      appState.versions['1.0.0'] = { version: '1.0.0' } as any;
      (isContentUnchanged as jest.Mock).mockReturnValueOnce(true);

      await appState.setVersion('v1.0.0');

      expect(getContent).toHaveBeenCalledTimes(1);
      expect(window.ElectronFiddle.app.setEditorValues).toHaveBeenCalledTimes(1);
    });
  });

  describe('setTheme()', () => {
    it('calls setupTheme()', () => {
      appState.setTheme('custom');

      expect(appState.theme).toBe('custom');
      expect(window.ElectronFiddle.app.setupTheme).toHaveBeenCalledTimes(1);
    });

    it('handles a missing theme name', () => {
      appState.setTheme();

      expect(appState.theme).toBe('');
      expect(window.ElectronFiddle.app.setupTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('setWarningDialogTexts()', () => {
    it('sets the warning dialog texts', () => {
      appState.setWarningDialogTexts({ label: 'foo' });
      expect(appState.warningDialogTexts).toEqual({
        label: 'foo',
        ok: 'Okay',
        cancel: 'Cancel'
      });
    });
  });

  describe('addLocalVersion()', () => {
    it('refreshes version state', async () => {
      appState.versions = {};

      await appState.addLocalVersion({
        localPath: '/fake/path',
        name: 'local-foo',
        version: '4.0.0'
      });

      // We just want to verify that the version state was
      // refreshed - we didn't actually add the local version
      // above, since versions.ts is mocked
      expect(Object.keys(appState.versions)).toEqual(
        ['2.0.2', '2.0.1', '1.8.7']
      );
    });
  });

  describe('updateDownloadedVersionState()', () => {
    it('downloads a version if necessary', async () => {
      const mockResult = Promise.resolve(['2.0.2']);
      (appState.binaryManager.getDownloadedVersions as jest.Mock).mockReturnValueOnce(mockResult);
      await appState.updateDownloadedVersionState();

      expect(appState.versions['2.0.2'].state).toBe(ElectronVersionState.ready);
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

      expect(appState.output[1].text).toBe('hi');
      expect(appState.output[1].timestamp).toBeTruthy();
    });

    it('ignores the "Debuggeer listening on..." output', () => {
      appState.pushOutput('Debugger listening on ws://localhost:123');
      expect(appState.output.length).toBe(1);
    });

    it('ignores the "For help see..." output', () => {
      appState.pushOutput('For help see https://nodejs.org/en/docs/inspector');
      expect(appState.output.length).toBe(1);
    });

    it('handles a complex buffer on Win32', () => {
      overridePlatform('win32');

      appState.pushOutput(Buffer.from('Buffer\r\nStuff'), { bypassBuffer: false });
      expect(appState.output[1].text).toBe('Buffer');

      resetPlatform();
    });
  });

  describe('pushError()', () => {
    it('pushes an error', () => {
      appState.pushError('Bwap bwap', new Error('Bwap bwap'));

      expect(appState.output[1].text).toBe('⚠️ Bwap bwap. Error encountered:');
      expect(appState.output[2].text).toBe('Error: Bwap bwap');
    });
  });

  describe('getAndRemoveEditorValueBackup()', () => {
    it('returns null if there is no backup', () => {
      const result = appState.getAndRemoveEditorValueBackup(EditorId.main);
      expect(result).toEqual(null);
    });

    it('returns and deletes a backup if there is one', () => {
      appState.closedPanels[EditorId.main] = { testBackup: true } as any;
      const result = appState.getAndRemoveEditorValueBackup(EditorId.main);
      expect(result).toEqual({ testBackup: true });
      expect(appState.closedPanels[EditorId.main]).toBeUndefined();
    });
  });

  describe('setVisibleMosaics()', () => {
    it('updates the visible editors and creates a backup', () => {
      appState.mosaicArrangement = createMosaicArrangement(ALL_MOSAICS);
      appState.closedPanels = {};
      appState.setVisibleMosaics([EditorId.main]);

      expect(appState.mosaicArrangement).toEqual(EditorId.main);
      expect(appState.closedPanels[EditorId.renderer]).toBeTruthy();
      expect(appState.closedPanels[EditorId.html]).toBeTruthy();
      expect(appState.closedPanels[EditorId.main]).toBeUndefined();
    });

    it('removes the backup for a non-editor right away', () => {
      appState.closedPanels = {};
      appState.closedPanels[PanelId.docsDemo] = true;
      appState.setVisibleMosaics(ALL_MOSAICS);

      expect(appState.closedPanels[PanelId.docsDemo]).toBeUndefined();
    });
  });

  describe('hideAndBackupMosaic()', () => {
    it('hides a given editor and creates a backup', () => {
      appState.mosaicArrangement = DEFAULT_MOSAIC_ARRANGEMENT;
      appState.closedPanels = {};
      appState.hideAndBackupMosaic(EditorId.main);

      expect(appState.mosaicArrangement).toEqual({
        direction: 'row',
        first: EditorId.renderer,
        second: EditorId.html
      });
      expect(appState.closedPanels[EditorId.main]).toBeTruthy();
      expect(appState.closedPanels[EditorId.renderer]).toBeUndefined();
      expect(appState.closedPanels[EditorId.html]).toBeUndefined();
    });
  });

  describe('showMosaic()', () => {
    it('shows a given editor', () => {
      appState.mosaicArrangement = EditorId.main;
      appState.showMosaic(EditorId.html);

      expect(appState.mosaicArrangement).toEqual({
        direction: 'row',
        first: EditorId.main,
        second: EditorId.html
      });
    });
  });
});
