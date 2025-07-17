import { makeObservable, observable } from 'mobx';
import { vi } from 'vitest';

import { BisectorMock } from './bisector';
import { VersionsMock } from './electron-versions';
import {
  BlockableAccelerator,
  ElectronReleaseChannel,
  GenericDialogOptions,
  GistActionState,
  RunnableVersion,
} from '../../src/interfaces';
import { EditorMosaic } from '../../src/renderer/editor-mosaic';
import { ELECTRON_MIRROR } from '../../src/renderer/mirror-constants';
import { objectDifference } from '../utils';

export class StateMock {
  public acceleratorsToBlock: BlockableAccelerator[] = [];
  public activeGistAction = GistActionState.none;
  public channelsToShow: ElectronReleaseChannel[] = [];
  public editorMosaic = new EditorMosaic();
  public environmentVariables: string[] = [];
  public executionFlags: string[] = [];
  public genericDialogLastInput: string | null = null;
  public genericDialogLastResult: boolean | null = null;
  public genericDialogOptions = {} as GenericDialogOptions;
  public gistId = '';
  public gitHubAvatarUrl: string | null = null;
  public gitHubLogin: string | null = null;
  public gitHubName: string | null = null;
  public gitHubPublishAsPublic = true;
  public gitHubToken: string | null = null;
  public isAddVersionDialogShowing = false;
  public isAutoBisecting = false;
  public isClearingConsoleOnRun = false;
  public isConfirmationPromptShowing = false;
  public isConsoleShowing = true;
  public isEnablingElectronLogging = false;
  public isGenericDialogShowing = false;
  public isInstallingModules = false;
  public isPublishingGistAsRevision = true;
  public isOnline = true;
  public isQuitting = false;
  public isRunning = false;
  public isSettingsShowing = false;
  public isTokenDialogShowing = false;
  public isTourShowing = false;
  public isUsingSystemTheme = true;
  public isWarningDialogShowing = false;
  public modules = new Map<string, string>();
  public output = [];
  public showObsoleteVersions = false;
  public showUndownloadedVersions = false;
  public theme: string | null = null;
  public title = 'Electron Fiddle';
  public version: string | null = null;
  public versions: Record<string, RunnableVersion> = {};
  public versionsToShow: RunnableVersion[] = [];
  public packageAuthor = 'electron<electron@electron.org>';
  public electronMirror = ELECTRON_MIRROR;
  public isBisectCommandShowing = false;
  public isDownloadingAll = false;
  public isDeletingAll = false;

  public Bisector: BisectorMock | undefined = new BisectorMock();
  public addAcceleratorToBlock = vi.fn();
  public addLocalVersion = vi.fn();
  public addNewVersions = vi.fn();
  public clearConsole = vi.fn();
  public currentElectronVersion = new VersionsMock().mockVersionsArray.shift()!;
  public disableTour = vi.fn();
  public downloadVersion = vi.fn();
  public getName = vi.fn();
  public hasVersion = vi
    .fn()
    .mockImplementation((version: string) => !!this.versions[version]);
  public hideChannels = vi.fn();
  public pushError = vi.fn();
  public pushOutput = vi.fn();
  public flushOutput = vi.fn();
  public removeAcceleratorToBlock = vi.fn();
  public removeVersion = vi.fn();
  public resetView = vi.fn();
  public setTheme = vi.fn();
  public setVersion = vi.fn().mockImplementation((version: string) => {
    this.currentElectronVersion = this.versions[version];
    this.version = version;
  });
  public isVersionUsable = vi.fn().mockImplementation(() => {
    return { ver: this.currentElectronVersion };
  });
  public findUsableVersion = vi.fn().mockImplementation(() => {
    const { mockVersionsArray } = new VersionsMock();
    return { ver: this.versions[mockVersionsArray[0].version] };
  });
  public startDownloadingAll = vi.fn().mockImplementation(() => {
    this.isDownloadingAll = true;
  });
  public stopDownloadingAll = vi.fn().mockImplementation(() => {
    this.isDownloadingAll = false;
  });
  public showChannels = vi.fn();
  public showConfirmDialog = vi.fn();
  public showErrorDialog = vi.fn();
  public showGenericDialog = vi.fn();
  public showInfoDialog = vi.fn();
  public showInputDialog = vi.fn();
  public signOutGitHub = vi.fn();
  public toggleAddMonacoThemeDialog = vi.fn();
  public toggleAddVersionDialog = vi.fn();
  public toggleAuthDialog = vi.fn();
  public toggleSettings = vi.fn();
  public updateElectronVersions = vi.fn();
  public startDeletingAll = vi.fn();
  public stopDeletingAll = vi.fn();

  constructor() {
    makeObservable(this, {
      acceleratorsToBlock: observable,
      activeGistAction: observable,
      channelsToShow: observable,
      editorMosaic: observable,
      environmentVariables: observable,
      executionFlags: observable,
      genericDialogLastInput: observable,
      genericDialogLastResult: observable,
      genericDialogOptions: observable,
      gistId: observable,
      gitHubAvatarUrl: observable,
      gitHubLogin: observable,
      gitHubName: observable,
      gitHubPublishAsPublic: observable,
      gitHubToken: observable,
      isAddVersionDialogShowing: observable,
      isAutoBisecting: observable,
      isClearingConsoleOnRun: observable,
      isConfirmationPromptShowing: observable,
      isConsoleShowing: observable,
      isEnablingElectronLogging: observable,
      isGenericDialogShowing: observable,
      isInstallingModules: observable,
      isOnline: observable,
      isPublishingGistAsRevision: observable,
      isQuitting: observable,
      isRunning: observable,
      isSettingsShowing: observable,
      isTokenDialogShowing: observable,
      isTourShowing: observable,
      isUsingSystemTheme: observable,
      isWarningDialogShowing: observable,
      modules: observable,
      output: observable,
      showObsoleteVersions: observable,
      showUndownloadedVersions: observable,
      theme: observable,
      title: observable,
      version: observable,
      versions: observable,
      versionsToShow: observable,
      packageAuthor: observable,
      electronMirror: observable,
      isBisectCommandShowing: observable,
      isDeletingAll: observable,
      isDownloadingAll: observable,
    });

    const { mockVersions: obj, mockVersionsArray: arr } = new VersionsMock();
    this.versions = obj;
    this.currentElectronVersion = arr[arr.length - 1];
    this.version = this.currentElectronVersion.version;
  }

  public initVersions(
    version: string,
    mockVersions: Record<string, RunnableVersion>,
  ) {
    this.versions = mockVersions;
    this.versionsToShow = Object.values(mockVersions);
    this.version = version;
    this.currentElectronVersion = mockVersions[version];
  }

  // Invoked when a snapshot is made.
  //
  // Snapshots get very "noisy" when they include the entire Mock's details.
  // We can avoid most of that noise by hiding fields that hold default values.
  public toJSON() {
    const o = objectDifference(this, new StateMock());

    const terserRunnable = (ver: RunnableVersion) =>
      [ver.version, ver.source, ver.state].join(' ');
    for (const [key, val] of Object.entries(o)) {
      if (key == 'currentElectronVersion') {
        o[key] = terserRunnable(val as RunnableVersion);
      } else if (key === 'versions') {
        o[key] = Object.values(val as Record<string, RunnableVersion>).map(
          terserRunnable,
        );
      } else if (key === 'versionsToShow') {
        o[key] = (val as Array<RunnableVersion>).map(terserRunnable);
      }
    }

    return Object.keys(o).length === 0 ? 'default StateMock' : o;
  }
}
