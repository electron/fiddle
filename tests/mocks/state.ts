import { observable } from 'mobx';

import {
  BlockableAccelerator,
  ElectronReleaseChannel,
  GenericDialogOptions,
  GistActionState,
  RunnableVersion,
} from '../../src/interfaces';
import { EditorMosaic } from '../../src/renderer/editor-mosaic';

import { objectDifference } from '../utils';
import { BisectorMock } from './bisector';
import { VersionsMock } from './electron-versions';

export class StateMock {
  @observable public acceleratorsToBlock: BlockableAccelerator[] = [];
  @observable public activeGistAction = GistActionState.none;
  @observable public channelsToShow: ElectronReleaseChannel[] = [];
  @observable public editorMosaic = new EditorMosaic();
  @observable public environmentVariables: string[] = [];
  @observable public executionFlags: string[] = [];
  @observable public genericDialogLastInput: string | null = null;
  @observable public genericDialogLastResult: boolean | null = null;
  @observable public genericDialogOptions: GenericDialogOptions = {} as any;
  @observable public gistId = '';
  @observable public gitHubAvatarUrl: string | null = null;
  @observable public gitHubLogin: string | null = null;
  @observable public gitHubName: string | null = null;
  @observable public gitHubPublishAsPublic = true;
  @observable public gitHubToken: string | null = null;
  @observable public isAddVersionDialogShowing = false;
  @observable public isAutoBisecting = false;
  @observable public isClearingConsoleOnRun = false;
  @observable public isConfirmationPromptShowing = false;
  @observable public isConsoleShowing = true;
  @observable public isEnablingElectronLogging = false;
  @observable public isGenericDialogShowing = false;
  @observable public isInstallingModules = false;
  @observable public isQuitting = false;
  @observable public isRunning = false;
  @observable public isSettingsShowing = false;
  @observable public isTokenDialogShowing = false;
  @observable public isTourShowing = false;
  @observable public isUsingSystemTheme = true;
  @observable public isWarningDialogShowing = false;
  @observable public output = [];
  @observable public showObsoleteVersions = false;
  @observable public showUndownloadedVersions = false;
  @observable public theme: string | null;
  @observable public title = 'Electron Fiddle';
  @observable public version: string;
  @observable public versions: Record<string, RunnableVersion>;
  @observable public versionsToShow: RunnableVersion[] = [];

  public Bisector = new BisectorMock();
  public addAcceleratorToBlock = jest.fn();
  public addLocalVersion = jest.fn();
  public addNewVersions = jest.fn();
  public clearConsole = jest.fn();
  public currentElectronVersion = new VersionsMock().mockVersionsArray.shift()!;
  public disableTour = jest.fn();
  public downloadVersion = jest.fn();
  public getName = jest.fn();
  public hasVersion = jest
    .fn()
    .mockImplementation((version: string) => !!this.versions[version]);
  public hideChannels = jest.fn();
  public pushError = jest.fn();
  public pushOutput = jest.fn();
  public flushOutput = jest.fn();
  public removeAcceleratorToBlock = jest.fn();
  public removeVersion = jest.fn();
  public resetView = jest.fn();
  public setTheme = jest.fn();
  public setVersion = jest.fn().mockImplementation((version: string) => {
    this.currentElectronVersion = this.versions[version];
    this.version = version;
  });
  public showChannels = jest.fn();
  public showConfirmDialog = jest.fn();
  public showErrorDialog = jest.fn();
  public showGenericDialog = jest.fn();
  public showInfoDialog = jest.fn();
  public showInputDialog = jest.fn();
  public signOutGitHub = jest.fn();
  public toggleAddVersionDialog = jest.fn();
  public toggleAuthDialog = jest.fn();
  public updateElectronVersions = jest.fn();

  constructor() {
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
        o[key] = terserRunnable(val) as any;
      } else if (key === 'versions') {
        o[key] = Object.values(val).map(terserRunnable) as any;
      } else if (key === 'versionsToShow') {
        o[key] = val.map(terserRunnable);
      }
    }

    return Object.keys(o).length === 0 ? 'default StateMock' : o;
  }
}
