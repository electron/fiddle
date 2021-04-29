import { observable } from 'mobx';
import { MosaicNode } from 'react-mosaic-component';

import {
  BlockableAccelerator,
  CustomEditorId,
  DocsDemoPage,
  ElectronReleaseChannel,
  GenericDialogOptions,
  GistActionState,
  MosaicId,
  RunnableVersion,
} from '../../src/interfaces';
import { EditorBackup } from '../../src/utils/editor-backup';

import { BisectorMock } from './bisector';
import { VersionsMock } from './electron-versions';

export class StateMock {
  @observable public acceleratorsToBlock: BlockableAccelerator[] = [];
  @observable public activeGistAction = GistActionState.none;
  @observable public channelsToShow: ElectronReleaseChannel[] = [];
  @observable public closedPanels: Partial<
    Record<MosaicId, EditorBackup | true>
  > = {};
  @observable public currentDocsDemoPage: DocsDemoPage = DocsDemoPage.DEFAULT;
  @observable public customMosaics: CustomEditorId[] = [];
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
  @observable public isRunning = false;
  @observable public isSettingsShowing = false;
  @observable public isTokenDialogShowing = false;
  @observable public isTourShowing = false;
  @observable public isUsingSystemTheme = true;
  @observable public isWarningDialogShowing = false;
  @observable public mosaicArrangement: MosaicNode<MosaicId> | null = null;
  @observable public output = [];
  @observable public showUndownloadedVersions = false;
  @observable public theme: string | null;
  @observable public title = 'Electron Fiddle';
  @observable public version: string;
  @observable public versions: Record<string, RunnableVersion>;
  @observable public versionsToShow: RunnableVersion[] = [];

  public Bisector = new BisectorMock();
  public addAcceleratorToBlock = jest.fn();
  public addLocalVersion = jest.fn();
  public clearConsole = jest.fn();
  public currentElectronVersion = new VersionsMock().mockVersionsArray.shift()!;
  public disableTour = jest.fn();
  public downloadVersion = jest.fn();
  public getAndRemoveEditorValueBackup = jest.fn();
  public getName = jest.fn();
  public hasVersion = jest
    .fn()
    .mockImplementation((version: string) => !!this.versions[version]);
  public hideAndBackupMosaic = jest.fn();
  public hideChannels = jest.fn();
  public pushError = jest.fn();
  public pushOutput = jest.fn();
  public removeAcceleratorToBlock = jest.fn();
  public removeCustomMosaic = jest.fn();
  public removeVersion = jest.fn();
  public setGenericDialogOptions = jest.fn().mockReturnValue({});
  public setTheme = jest.fn();
  public setVersion = jest.fn().mockImplementation((version: string) => {
    this.version = version;
    this.currentElectronVersion = this.versions[version];
  });
  public setVisibleMosaics = jest.fn();
  public showChannels = jest.fn();
  public showCustomEditorDialog = jest.fn();
  public showMosaic = jest.fn();
  public signOutGitHub = jest.fn();
  public toggleAddVersionDialog = jest.fn();
  public toggleAuthDialog = jest.fn();
  public toggleGenericDialog = jest.fn();
  public toggleWarningDialog = jest.fn();
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
}
