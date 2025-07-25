import { IReactionDisposer, reaction } from 'mobx';
import {
  type MockInstance,
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AppStateBroadcastMessageType,
  BlockableAccelerator,
  ElectronReleaseChannel,
  GenericDialogType,
  InstallState,
  MAIN_JS,
  RunnableVersion,
  Version,
  VersionSource,
} from '../../src/interfaces';
import { Bisector } from '../../src/renderer/bisect';
import { AppState } from '../../src/renderer/state';
import {
  fetchVersions,
  getElectronVersions,
  makeRunnable,
  saveLocalVersions,
} from '../../src/renderer/versions';
import { VersionsMock, createEditorValues } from '../mocks/mocks';
import { overrideRendererPlatform, resetRendererPlatform } from '../utils';

vi.mock('../../src/renderer/versions', async () => {
  const { getReleaseChannel } = await vi.importActual<
    typeof import('../../src/renderer/versions')
  >('../../src/renderer/versions');
  const { VersionsMock } = await import('../mocks/electron-versions.js');
  const { mockVersionsArray } = new VersionsMock();

  return {
    addLocalVersion: vi.fn(),
    fetchVersions: vi.fn(() => mockVersionsArray),
    getDefaultVersion: () => '2.0.2',
    getElectronVersions: vi.fn(),
    getReleaseChannel,
    makeRunnable: vi.fn((v) => v),
    saveLocalVersions: vi.fn(),
  };
});

describe('AppState', () => {
  let appState: AppState;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];
  let removeSpy: MockInstance;
  let ensureDownloadedSpy: MockInstance;
  let broadcastMessageSpy: MockInstance;

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new VersionsMock());

    vi.mocked(fetchVersions).mockResolvedValue(mockVersionsArray);
    vi.mocked(window.ElectronFiddle.getVersionState).mockReturnValue(
      InstallState.installed,
    );

    appState = new AppState(mockVersionsArray);
    removeSpy = vi
      .spyOn(window.ElectronFiddle, 'removeVersion')
      .mockResolvedValue(InstallState.missing);
    ensureDownloadedSpy = vi
      .spyOn(window.ElectronFiddle, 'downloadVersion')
      .mockResolvedValue(undefined);
    broadcastMessageSpy = vi.spyOn(
      (appState as any).broadcastChannel,
      'postMessage',
    );
  });

  it('exists', () => {
    expect(appState).toBeTruthy();
  });

  afterAll(async () => {
    // Wait for all the async task to resolve before the vitest
    // environment tears down
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  describe('updateElectronVersions()', () => {
    it('handles errors gracefully', async () => {
      vi.mocked(fetchVersions).mockRejectedValue(new Error('Bwap-bwap'));
      await appState.updateElectronVersions();
    });

    it('adds new versions', async () => {
      const version = '100.0.0';
      const ver: Version = { version };

      vi.mocked(fetchVersions).mockResolvedValue([ver]);
      vi.mocked(makeRunnable).mockImplementation(
        (v: Version): RunnableVersion => v as RunnableVersion,
      );

      const oldCount = Object.keys(appState.versions).length;

      await appState.updateElectronVersions();
      const newCount = Object.keys(appState.versions).length;
      expect(newCount).toBe(oldCount + 1);
      expect(appState.versions[version]).toStrictEqual(ver);
      expect(broadcastMessageSpy).toHaveBeenCalledWith({
        type: AppStateBroadcastMessageType.syncVersions,
        payload: [ver],
      });
    });
  });

  describe('getName()', () => {
    it('returns the name', async () => {
      (appState as any).name = 'hi';
      expect(await appState.getName()).toBe('hi');
    });

    it('returns the name, even if none exists', async () => {
      vi.mocked(window.ElectronFiddle.getProjectName).mockResolvedValue('test');
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
      appState.channelsToShow = [ElectronReleaseChannel.stable];
      expect(appState.versionsToShow.length).toEqual(mockVersionsArray.length);
    });

    it('handles undownloaded versions', () => {
      Object.values(appState.versions).forEach(
        (ver) => (ver.state = InstallState.missing),
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
      broadcastMessageSpy.mockClear();
      await appState.removeVersion(ver);
      expect(removeSpy).not.toHaveBeenCalled();
      expect(broadcastMessageSpy).not.toHaveBeenCalled();
    });

    it('removes a version', async () => {
      const ver = appState.versions[version];
      ver.state = InstallState.installed;
      vi.mocked(window.ElectronFiddle.getVersionState).mockReturnValue(
        InstallState.missing,
      );
      await appState.removeVersion(ver);
      expect(removeSpy).toHaveBeenCalledWith(ver.version);
      expect(broadcastMessageSpy).toHaveBeenCalledWith({
        type: AppStateBroadcastMessageType.syncVersions,
        payload: [ver],
      });
    });

    it('does not remove it if not necessary', async () => {
      const ver = appState.versions[version];
      ver.state = InstallState.missing;
      broadcastMessageSpy.mockClear();
      await appState.removeVersion(ver);
      expect(removeSpy).toHaveBeenCalledTimes(0);
      expect(broadcastMessageSpy).not.toHaveBeenCalled();
    });

    it('removes (but does not delete) a local version', async () => {
      const localPath = '/fake/path';

      const ver = appState.versions[version];
      ver.localPath = localPath;
      ver.source = VersionSource.local;
      ver.state = InstallState.installed;

      broadcastMessageSpy.mockClear();
      await appState.removeVersion(ver);

      expect(saveLocalVersions).toHaveBeenCalledTimes(1);
      expect(appState.versions[version]).toBeUndefined();
      expect(removeSpy).toHaveBeenCalledTimes(0);
      expect(broadcastMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe('downloadVersion()', () => {
    it('downloads a version', async () => {
      const ver = appState.versions['2.0.2'];
      ver.state = InstallState.missing;

      await appState.downloadVersion(ver);

      expect(ensureDownloadedSpy).toHaveBeenCalled();
      expect(broadcastMessageSpy).toHaveBeenCalledWith({
        type: AppStateBroadcastMessageType.syncVersions,
        payload: [ver],
      });
    });

    it('does not download a version if already ready', async () => {
      const ver = appState.versions['2.0.2'];
      ver.state = InstallState.installed;

      broadcastMessageSpy.mockClear();
      await appState.downloadVersion(ver);

      expect(ensureDownloadedSpy).not.toHaveBeenCalled();
      expect(broadcastMessageSpy).not.toHaveBeenCalled();
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
      appState.downloadVersion = vi.fn();
      await appState.setVersion('v2.0.2');

      expect(appState.downloadVersion).toHaveBeenCalled();
    });

    it('falls back if downloading the new version fails', async () => {
      appState.downloadVersion = vi
        .fn()
        .mockRejectedValueOnce(new Error('FAILURE'));
      appState.showGenericDialog = vi.fn().mockResolvedValueOnce({
        confirm: true,
      });

      await appState.setVersion('v2.0.2');
      expect(appState.showGenericDialog).toHaveBeenCalledWith({
        label: 'Failed to download Electron version 2.0.2',
        ok: 'Close',
        type: GenericDialogType.warning,
        wantsInput: false,
      });
    });

    describe('loads the template for the new version', () => {
      let newVersion: string;
      let oldVersion: string;
      // TODO(dsanders11): improve this type
      let replaceSpy: any;
      const nextValues = createEditorValues();

      beforeEach(() => {
        // pick some version that differs from the current version
        oldVersion = appState.version;
        newVersion = Object.keys(appState.versions)
          .filter((version) => version !== oldVersion)
          .shift()!;
        expect(newVersion).not.toStrictEqual(oldVersion);
        expect(newVersion).toBeTruthy();

        // spy on app.replaceFiddle
        replaceSpy = vi.spyOn(window.app, 'replaceFiddle');
        replaceSpy.mockReset();

        vi.mocked(window.ElectronFiddle.getTemplate).mockResolvedValue(
          nextValues,
        );
      });

      it('if there is no current fiddle', async () => {
        // setup: current fiddle is empty
        appState.editorMosaic.set({});

        await appState.setVersion(newVersion);
        expect(replaceSpy).toHaveBeenCalledTimes(1);
        const templateName = newVersion;
        expect(replaceSpy).toHaveBeenCalledWith(nextValues, { templateName });
      });

      it('if the current fiddle is an unedited template', async () => {
        appState.templateName = oldVersion;
        appState.editorMosaic.set({ [MAIN_JS]: '// content' });
        appState.editorMosaic.isEdited = false;

        await appState.setVersion(newVersion);
        const templateName = newVersion;
        expect(replaceSpy).toHaveBeenCalledWith(nextValues, { templateName });
      });

      it('but not if the current fiddle is edited', async () => {
        appState.editorMosaic.set({ [MAIN_JS]: '// content' });
        appState.editorMosaic.isEdited = true;
        appState.templateName = oldVersion;

        await appState.setVersion(newVersion);
        expect(replaceSpy).not.toHaveBeenCalled();
      });

      it('but not if the current fiddle is not a template', async () => {
        appState.editorMosaic.set({ [MAIN_JS]: '// content' });
        appState.localPath = '/some/path/to/a/fiddle';

        await appState.setVersion(newVersion);
        expect(replaceSpy).not.toHaveBeenCalled();
      });
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
      expect(window.app.loadTheme).toHaveBeenCalledTimes(1);
    });

    it('handles a missing theme name', () => {
      appState.setTheme(null);

      expect(appState.theme).toBe(null);
      expect(window.app.loadTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('dialog helpers', () => {
    let dispose: IReactionDisposer;

    afterEach(() => {
      if (dispose) dispose();
    });

    function registerDialogHandler(input: string | null, result: boolean) {
      dispose = reaction(
        () => appState.isGenericDialogShowing,
        () => {
          appState.genericDialogLastInput = input;
          appState.genericDialogLastResult = result;
          appState.isGenericDialogShowing = false;
        },
      );
    }

    const Input = 'Entropy requires no maintenance.';
    const DefaultInput = 'default input';

    const Opts = {
      label: 'foo',
      ok: 'Close',
      type: GenericDialogType.warning,
      wantsInput: false,
    } as const;

    describe('showGenericDialog()', () => {
      it('shows a dialog', async () => {
        const promise = appState.showGenericDialog(Opts);
        expect(appState.isGenericDialogShowing).toBe(true);
        appState.isGenericDialogShowing = false;
        await promise;
      });

      it('resolves when the dialog is dismissed', async () => {
        registerDialogHandler(Input, true);
        const promise = appState.showGenericDialog(Opts);
        await promise;
        expect(appState).toHaveProperty('isGenericDialogShowing', false);
      });

      it('returns true if confirmed by user', async () => {
        registerDialogHandler(Input, true);
        const result = await appState.showGenericDialog(Opts);
        expect(result).toHaveProperty('confirm', true);
      });

      it('returns false if rejected by user', async () => {
        registerDialogHandler(Input, false);
        const result = await appState.showGenericDialog(Opts);
        expect(result).toHaveProperty('confirm', false);
      });

      it('returns the user-inputted text', async () => {
        registerDialogHandler(Input, true);
        const result = await appState.showGenericDialog({
          ...Opts,
          defaultInput: DefaultInput,
        });
        expect(result).toHaveProperty('input', Input);
      });

      it('returns defaultInput as a fallback', async () => {
        registerDialogHandler(null, true);
        const result = await appState.showGenericDialog({
          ...Opts,
          defaultInput: DefaultInput,
        });
        expect(result).toHaveProperty('input', DefaultInput);
      });

      it('returns an empty string as a last resort', async () => {
        registerDialogHandler(null, true);
        const result = await appState.showGenericDialog(Opts);
        expect(result).toHaveProperty('input', '');
      });
    });

    describe('showInputDialog', () => {
      const input = 'fnord' as const;
      const inputOpts = {
        label: 'label',
        ok: 'Close',
        placeholder: 'Placeholder',
      } as const;

      it('returns text when confirmed', async () => {
        appState.showGenericDialog = vi.fn().mockResolvedValueOnce({
          confirm: true,
          input,
        });
        const result = await appState.showInputDialog(inputOpts);
        expect(result).toBe(input);
      });

      it('returns undefined when canceled', async () => {
        appState.showGenericDialog = vi.fn().mockResolvedValueOnce({
          confirm: false,
          input,
        });
        const result = await appState.showInputDialog(inputOpts);
        expect(result).toBeUndefined();
      });
    });

    describe('showConfirmDialog', () => {
      const label = 'Do you want to confirm this dialog?';
      async function testConfirmDialog(confirm: boolean) {
        appState.showGenericDialog = vi.fn().mockResolvedValueOnce({
          confirm,
          input: undefined,
        });
        const result = await appState.showConfirmDialog({
          label,
          ok: 'Confirm',
        });
        expect(result).toBe(confirm);
      }

      it('returns true when confirmed', () => testConfirmDialog(true));
      it('returns false when canceled', () => testConfirmDialog(false));
    });

    describe('showErrorDialog', () => {
      const label = 'This is an error message.';

      it('shows an error dialog', async () => {
        appState.showGenericDialog = vi.fn().mockResolvedValueOnce({
          confirm: true,
        });
        await appState.showErrorDialog(label);
        expect(appState.showGenericDialog).toHaveBeenCalledWith({
          label,
          ok: 'Close',
          type: GenericDialogType.warning,
          wantsInput: false,
        });
      });
    });

    describe('showInfoDialog', () => {
      const label = 'This is an informational message.';

      it('shows an error dialog', async () => {
        appState.showGenericDialog = vi.fn().mockResolvedValueOnce({
          confirm: true,
        });
        await appState.showInfoDialog(label);
        expect(appState.showGenericDialog).toHaveBeenCalledWith({
          label,
          ok: 'Close',
          type: GenericDialogType.success,
          wantsInput: false,
        });
      });
    });
  });

  describe('addLocalVersion()', () => {
    it('refreshes version state', async () => {
      const version = '4.0.0';
      const ver: RunnableVersion = {
        localPath: '/fake/path',
        name: 'local-foo',
        version,
        source: VersionSource.local,
        state: InstallState.installed,
      };

      vi.mocked(getElectronVersions).mockReturnValue([ver]);

      appState.addLocalVersion(ver);

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
      expect(appState.output[1].timeString).toBeTruthy();
    });

    it('ignores the "Debugger listening on..." output', () => {
      appState.pushOutput('Debugger listening on ws://localhost:123');
      expect(appState.output.length).toBe(1);
    });

    it('ignores the "For help, see: ..." output', () => {
      appState.pushOutput(
        'For help, see: https://nodejs.org/en/docs/inspector',
      );
      expect(appState.output.length).toBe(1);
    });

    it('handles a complex buffer on Win32', () => {
      overrideRendererPlatform('win32');

      appState.pushOutput(Buffer.from('Buffer\r\nStuff\nMore'), {
        bypassBuffer: false,
      });
      expect(appState.output[1].text).toBe('Buffer');
      expect(appState.output[2].text).toBe('Stuff');

      resetRendererPlatform();
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

    it('flags unsaved fiddles', () => {
      const expected = `${APPNAME} - Unsaved`;
      appState.editorMosaic.isEdited = true;
      const actual = appState.title;
      expect(actual).toBe(expected);
    });
  });

  describe('startDownloadingAll()', () => {
    it('change isDownloadingAll to true when false', () => {
      appState.isDownloadingAll = false;
      appState.startDownloadingAll();
      expect(appState.isDownloadingAll).toBe(true);
      expect(broadcastMessageSpy).toHaveBeenCalledWith({
        type: AppStateBroadcastMessageType.isDownloadingAll,
        payload: true,
      });
    });

    it('takes no action when isDownloadingAll is true', () => {
      appState.isDownloadingAll = true;
      appState.startDownloadingAll();
      expect(appState.isDownloadingAll).toBe(true);
    });
  });

  describe('stopDownloadingAll()', () => {
    it('change isDownloadingAll to false when true', () => {
      appState.isDownloadingAll = true;
      appState.stopDownloadingAll();
      expect(appState.isDownloadingAll).toBe(false);
      expect(broadcastMessageSpy).toHaveBeenCalledWith({
        type: AppStateBroadcastMessageType.isDownloadingAll,
        payload: false,
      });
    });

    it('takes no action when isDownloadingAll is false', () => {
      appState.isDownloadingAll = false;
      appState.stopDownloadingAll();
      expect(appState.isDownloadingAll).toBe(false);
    });
  });

  describe('startDeletingAll()', () => {
    it('change isDeletingAll to true when false', () => {
      appState.isDeletingAll = false;
      appState.startDeletingAll();
      expect(appState.isDeletingAll).toBe(true);
    });

    it('takes no action when isDeletingAll is true', () => {
      appState.isDeletingAll = true;
      appState.startDeletingAll();
      expect(appState.isDeletingAll).toBe(true);
    });
  });

  describe('stopDeletingAll()', () => {
    it('change isDeletingAll to false when true', () => {
      appState.isDeletingAll = true;
      appState.stopDeletingAll();
      expect(appState.isDeletingAll).toBe(false);
    });

    it('takes no action when isDeletingAll is false', () => {
      appState.isDeletingAll = false;
      appState.stopDeletingAll();
      expect(appState.isDeletingAll).toBe(false);
    });
  });

  describe('broadcastChannel', () => {
    it('updates the version state in response to changes in other windows', async () => {
      const fakeVersion = {
        version: '13.9.9',
        state: InstallState.downloading,
      } as RunnableVersion;

      expect(appState.versions[fakeVersion.version]).toBeFalsy();

      (appState as any).broadcastChannel.postMessage({
        type: AppStateBroadcastMessageType.syncVersions,
        payload: [fakeVersion],
      });

      expect(appState.versions[fakeVersion.version].state).toEqual(
        InstallState.downloading,
      );
    });
  });
});
