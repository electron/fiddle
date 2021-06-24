import { reaction } from 'mobx';
import {
  BlockableAccelerator,
  ElectronReleaseChannel,
  GenericDialogType,
  RunnableVersion,
  Version,
  VersionSource,
  VersionState,
} from '../../src/interfaces';
import {
  getVersionState,
  removeBinary,
  setupBinary,
} from '../../src/renderer/binary';
import { Bisector } from '../../src/renderer/bisect';
import { getTemplate } from '../../src/renderer/content';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { AppState } from '../../src/renderer/state';
import { getElectronVersions } from '../../src/renderer/versions';
import {
  getUpdatedElectronVersions,
  saveLocalVersions,
} from '../../src/renderer/versions';
import { getName } from '../../src/utils/get-name';
import { VersionsMock } from '../mocks/mocks';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/renderer/content', () => ({
  getTemplate: jest.fn(),
}));
jest.mock('../../src/renderer/binary', () => ({
  removeBinary: jest.fn(),
  setupBinary: jest.fn(),
  getVersionState: jest.fn().mockImplementation((v) => v.state),
}));
jest.mock('../../src/renderer/fetch-types', () => ({
  getLocalTypePathForVersion: jest.fn(),
  updateEditorTypeDefinitions: jest.fn(),
}));
jest.mock('../../src/renderer/versions', () => {
  const { getReleaseChannel } = jest.requireActual(
    '../../src/renderer/versions',
  );
  const { VersionsMock } = require('../mocks/electron-versions');
  const { mockVersionsArray } = new VersionsMock();

  return {
    addLocalVersion: jest.fn(),
    getDefaultVersion: () => '2.0.2',
    getElectronVersions: jest.fn(),
    getOldestSupportedVersion: jest.fn(),
    getReleaseChannel,
    getUpdatedElectronVersions: jest.fn().mockResolvedValue(mockVersionsArray),
    saveLocalVersions: jest.fn(),
  };
});
jest.mock('../../src/utils/get-name', () => ({
  getName: jest.fn(),
}));
jest.mock('../../src/renderer/ipc');

describe('AppState', () => {
  let appState: AppState;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new VersionsMock());

    (getUpdatedElectronVersions as jest.Mock).mockResolvedValue(
      mockVersionsArray,
    );
    (getVersionState as jest.Mock).mockImplementation((v) => v.state);

    appState = new AppState(mockVersionsArray);

    ipcRendererManager.removeAllListeners();
  });

  it('exists', () => {
    expect(appState).toBeTruthy();
  });

  describe('updateElectronVersions()', () => {
    it('handles errors gracefully', async () => {
      (getUpdatedElectronVersions as jest.Mock).mockImplementationOnce(
        async () => {
          throw new Error('Bwap-bwap');
        },
      );

      await appState.updateElectronVersions();
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

      expect(appState.currentElectronVersion).toEqual(mockVersions['2.0.2']);
    });

    it('falls back to the defaultVersion', () => {
      appState.version = 'garbage';

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

  describe('toggleGenericDialog()', () => {
    it('toggles the warning dialog', () => {
      appState.genericDialogLastResult = true;

      appState.toggleGenericDialog();
      expect(appState.isGenericDialogShowing).toBe(true);
      expect(appState.genericDialogLastResult).toBe(null);

      appState.toggleGenericDialog();
      expect(appState.isGenericDialogShowing).toBe(false);
    });
  });

  describe('setIsQuitting()', () => {
    it('sets isQuitting variable as true', () => {
      appState.setIsQuitting();
      expect(appState.isQuitting).toBe(true);
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

  describe('versionsToShow()', () => {
    it('returns all versions for no filters', () => {
      expect(appState.versionsToShow.length).toEqual(
        Object.keys(appState.versions).length,
      );
    });

    it('handles empty items', () => {
      const originalLength = Object.keys(appState.versions).length;
      appState.versions.foo = undefined as any;

      expect(appState.versionsToShow.length).toEqual(originalLength);
    });

    it('excludes channels', () => {
      appState.channelsToShow = ['Unsupported' as any];
      expect(appState.versionsToShow.length).toEqual(0);
      appState.channelsToShow = ['Stable' as any];
      expect(appState.versionsToShow.length).toEqual(mockVersionsArray.length);
    });

    it('handles undownloaded versions', () => {
      Object.values(appState.versions).forEach(
        (ver) => (ver.state = VersionState.unknown),
      );

      appState.showUndownloadedVersions = false;
      expect(appState.versionsToShow.length).toEqual(0);

      appState.showUndownloadedVersions = true;
      expect(appState.versionsToShow.length).toEqual(mockVersionsArray.length);
    });
  });

  describe('showChannels()', () => {
    it('adds channels from `channelsToShow`', () => {
      appState.channelsToShow = [
        ElectronReleaseChannel.beta,
        ElectronReleaseChannel.stable,
      ];
      appState.showChannels([
        ElectronReleaseChannel.beta,
        ElectronReleaseChannel.nightly,
      ]);
      expect([...appState.channelsToShow].sort()).toEqual([
        ElectronReleaseChannel.beta,
        ElectronReleaseChannel.nightly,
        ElectronReleaseChannel.stable,
      ]);
    });
  });

  describe('hideChannels()', () => {
    it('removes channels from `channelsToShow`', () => {
      appState.channelsToShow = [
        ElectronReleaseChannel.beta,
        ElectronReleaseChannel.nightly,
        ElectronReleaseChannel.stable,
      ];
      appState.hideChannels([ElectronReleaseChannel.beta]);
      expect([...appState.channelsToShow].sort()).toEqual([
        ElectronReleaseChannel.nightly,
        ElectronReleaseChannel.stable,
      ]);
    });
  });

  describe('removeVersion()', () => {
    let active: string;
    let version: string;

    beforeEach(() => {
      active = appState.currentElectronVersion.version;
      version = mockVersionsArray.find((v) => v.version !== active)!.version;
    });

    it('does not remove the active version', async () => {
      const ver = appState.versions[active];
      await appState.removeVersion(ver);
      expect(removeBinary).not.toHaveBeenCalled();
    });

    it('removes a version', async () => {
      const ver = appState.versions[version];
      ver.state = VersionState.ready;
      await appState.removeVersion(ver);
      expect(removeBinary).toHaveBeenCalledWith<any>(ver);
    });

    it('does not remove it if not necessary', async () => {
      const ver = appState.versions[version];
      ver.state = VersionState.unknown;
      await appState.removeVersion(ver);
      expect(removeBinary).toHaveBeenCalledTimes(0);
    });

    it('removes (but does not delete) a local version', async () => {
      const localPath = '/fake/path';

      const ver = appState.versions[version];
      ver.localPath = localPath;
      ver.source = VersionSource.local;
      ver.state = VersionState.ready;

      await appState.removeVersion(ver);

      expect(saveLocalVersions).toHaveBeenCalledTimes(1);
      expect(appState.versions[version]).toBeUndefined();
      expect(removeBinary).toHaveBeenCalledTimes(0);
    });
  });

  describe('downloadVersion()', () => {
    it('downloads a version', async () => {
      const ver = appState.versions['2.0.2'];
      ver.state = VersionState.unknown;

      await appState.downloadVersion(ver);

      expect(setupBinary).toHaveBeenCalledWith<any>(ver);
    });

    it('does not download a version if already ready', async () => {
      const ver = appState.versions['2.0.2'];
      ver.state = VersionState.ready;

      await appState.downloadVersion(ver);

      expect(setupBinary).not.toHaveBeenCalled();
    });
  });

  describe('hasVersion()', () => {
    it('returns false if state does not have that version', () => {
      const UNKNOWN_VERSION = 'v999.99.99';

      expect(appState.hasVersion(UNKNOWN_VERSION)).toEqual(false);
    });
    it('returns true if state has that version', () => {
      const KNOWN_VERSION = Object.keys(appState.versions).pop();

      expect(appState.hasVersion(KNOWN_VERSION!)).toBe(true);
    });
  });

  describe('setVersion()', () => {
    it('uses the newest version iff the specified version does not exist', async () => {
      await appState.setVersion('v999.99.99');
      expect(appState.version).toBe(mockVersionsArray[0].version);
    });

    it('downloads a version if necessary', async () => {
      appState.downloadVersion = jest.fn();
      await appState.setVersion('v2.0.2');

      expect(appState.downloadVersion).toHaveBeenCalled();
    });

    it('possibly updates the editors', async () => {
      const { replaceFiddle } = window.ElectronFiddle.app;
      (replaceFiddle as jest.Mock).mockReset();

      appState.versions['1.0.0'] = { version: '1.0.0' } as any;
      appState.editorMosaic.isEdited = false;

      (getTemplate as jest.Mock).mockReset().mockResolvedValueOnce({
        defaultMosaics: {},
        customMosaics: {},
      });

      await appState.setVersion('v1.0.0');

      expect(getTemplate).toHaveBeenCalledTimes(1);
      expect(replaceFiddle).toHaveBeenCalledTimes(1);
    });

    it('updates typescript definitions', async () => {
      const version = '2.0.2';
      const ver = appState.versions[version];
      ver.source = VersionSource.local;
      appState.setVersion(version);
    });
  });

  describe('setTheme()', () => {
    it('calls loadTheme()', () => {
      appState.setTheme('custom');

      expect(appState.theme).toBe('custom');
      expect(window.ElectronFiddle.app.loadTheme).toHaveBeenCalledTimes(1);
    });

    it('handles a missing theme name', () => {
      appState.setTheme();

      expect(appState.theme).toBe('');
      expect(window.ElectronFiddle.app.loadTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('runConfirmationDialog()', () => {
    let dispose: any;

    afterEach(() => {
      if (dispose) dispose();
    });

    function registerDialogHandler(
      description: string | null,
      result: boolean,
    ) {
      dispose = reaction(
        () => appState.isGenericDialogShowing,
        () => {
          appState.genericDialogLastInput = description;
          appState.genericDialogLastResult = result;
          appState.isGenericDialogShowing = false;
        },
      );
    }

    const Description = 'some non-default description';

    const Opts = {
      type: GenericDialogType.warning,
      label: 'foo',
    } as const;

    it('returns true if confirmed by user', async () => {
      registerDialogHandler(Description, true);
      const response = await appState.runConfirmationDialog(Opts);
      expect(response).toBe(true);
    });

    it('returns false if rejected by user', async () => {
      registerDialogHandler(Description, false);
      const response = await appState.runConfirmationDialog(Opts);
      expect(response).toBe(false);
    });
  });

  describe('setGenericDialogOptions()', () => {
    it('sets the warning dialog options', () => {
      appState.setGenericDialogOptions({
        type: GenericDialogType.warning,
        label: 'foo',
      });
      expect(appState.genericDialogOptions).toEqual({
        type: GenericDialogType.warning,
        label: 'foo',
        ok: 'Okay',
        placeholder: '',
        cancel: 'Cancel',
        wantsInput: false,
      });
    });
  });

  describe('addLocalVersion()', () => {
    it('refreshes version state', async () => {
      const version = '4.0.0';
      const ver: Version = {
        localPath: '/fake/path',
        name: 'local-foo',
        version,
      };

      (getElectronVersions as jest.Mock).mockReturnValue([ver]);

      await appState.addLocalVersion(ver);

      expect(getElectronVersions).toHaveBeenCalledTimes(1);
      expect(appState.getVersion(version)).toStrictEqual(ver);
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

      appState.pushOutput(Buffer.from('Buffer\r\nStuff'), {
        bypassBuffer: false,
      });
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

  describe('blockAccelerators()', () => {
    it('adds an accelerator to be blocked', () => {
      appState.acceleratorsToBlock = [];

      appState.addAcceleratorToBlock(BlockableAccelerator.save);
      expect(appState.acceleratorsToBlock).toEqual([BlockableAccelerator.save]);

      appState.addAcceleratorToBlock(BlockableAccelerator.save);
      expect(appState.acceleratorsToBlock).toEqual([BlockableAccelerator.save]);
    });

    it('removes an accelerator to be blocked', () => {
      appState.acceleratorsToBlock = [BlockableAccelerator.save];

      appState.removeAcceleratorToBlock(BlockableAccelerator.save);
      expect(appState.acceleratorsToBlock).toEqual([]);

      appState.removeAcceleratorToBlock(BlockableAccelerator.save);
      expect(appState.acceleratorsToBlock).toEqual([]);
    });
  });

  describe('title', () => {
    const APPNAME = 'Electron Fiddle';

    it('defaults to the appname', () => {
      const expected = APPNAME;
      const actual = appState.title;
      expect(actual).toBe(expected);
    });

    it('shows the name of local fiddles', () => {
      const localPath = 'path/to/fiddle';
      const expected = `${APPNAME} - ${localPath}`;
      appState.localPath = localPath;
      const actual = appState.title;
      expect(actual).toBe(expected);
    });

    it('shows the name of gist fiddles', () => {
      const gistId = 'abcdef';
      const expected = `${APPNAME} - gist.github.com/${gistId}`;
      appState.gistId = gistId;
      const actual = appState.title;
      expect(actual).toBe(expected);
    });

    it('prefers to display localPath', () => {
      const gistId = 'abcdef';
      const templateName = 'BrowserWindow';
      const localPath = 'path/to/fiddle';
      const expected = `${APPNAME} - ${localPath}`;
      Object.assign(appState, { gistId, localPath, templateName });
      const actual = appState.title;
      expect(actual).toBe(expected);
    });

    it('shows the name of template fiddles', () => {
      const templateName = 'BrowserWindow';
      const expected = `${APPNAME} - ${templateName}`;
      appState.templateName = templateName;
      const actual = appState.title;
      expect(actual).toBe(expected);
    });

    it('flags unsaved fiddles', () => {
      const expected = `${APPNAME} - Unsaved`;
      appState.editorMosaic.isEdited = true;
      const actual = appState.title;
      expect(actual).toBe(expected);
    });
  });
});
