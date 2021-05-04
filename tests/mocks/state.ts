import { observable, toJS } from 'mobx';
import { MosaicNode } from 'react-mosaic-component';

import {
  BlockableAccelerator,
  DefaultEditorId,
  EditorId,
  ElectronReleaseChannel,
  GenericDialogOptions,
  GistActionState,
  RunnableVersion,
} from '../../src/interfaces';
import { EditorBackup } from '../../src/utils/editor-backup';

import { BisectorMock } from './bisector';
import { EditorMosaicMock } from './editor-mosaic';
import { MonacoEditorMock } from './monaco-editor';
import { VersionsMock } from './electron-versions';

export class StateMock {
  @observable public acceleratorsToBlock: BlockableAccelerator[] = [];
  @observable public activeGistAction = GistActionState.none;
  @observable public channelsToShow: ElectronReleaseChannel[] = [];
  @observable public closedPanels: Partial<
    Record<EditorId, EditorBackup | true>
  > = {};
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
  @observable public output = [];
  @observable public showUndownloadedVersions = false;
  @observable public theme: string | null;
  @observable public title = 'Electron Fiddle';
  @observable public version: string;
  @observable public versions: Record<string, RunnableVersion>;
  @observable public versionsToShow: RunnableVersion[] = [];

  // editor mosaic
  @observable public customMosaics: EditorId[] = [];
  @observable public editorMosaic = new EditorMosaicMock();
  @observable public mosaicArrangement: MosaicNode<EditorId> | null = null;

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
  public flushOutput = jest.fn();
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

    for (const filename of [
      DefaultEditorId.main,
      DefaultEditorId.renderer,
      DefaultEditorId.html,
      DefaultEditorId.preload,
    ]) {
      this.editorMosaic.editors.set(filename, new MonacoEditorMock());
    }
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
    const defaultValues = new StateMock();
    const serialize = (input: any) => JSON.stringify(toJS(input));
    const isDefaultValue = (key: string, value: any) =>
      serialize(value) === serialize(defaultValues[key]);
    const terserRunnable = (ver: RunnableVersion) =>
      [ver.version, ver.source, ver.state].join(' ');

    const o = {};
    for (const entry of Object.entries(this)) {
      const key = entry[0];
      let val = toJS(entry[1]);

      // omit any fields that have the default value
      if (isDefaultValue(key, val)) continue;

      // make some verbose properties a little terser
      if (key == 'currentElectronVersion') {
        val = terserRunnable(val);
      } else if (key === 'versions') {
        val = Object.values(val).map(terserRunnable);
      } else if (key === 'versionsToShow') {
        val = val.map(terserRunnable);
      }

      o[key] = val;
    }

    return Object.keys(o).length === 0 ? 'default StateMock' : o;
  }
}
