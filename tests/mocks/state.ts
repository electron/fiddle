import { observable } from 'mobx';
import { MosaicNode } from 'react-mosaic-component';

import {
  CustomEditorId,
  DocsDemoPage,
  GistActionState,
  MosaicId,
  RunnableVersion,
} from '../../src/interfaces';
import { EditorBackup } from '../../src/utils/editor-backup';

import { BisectorMock } from './bisector';
import { MockVersions } from './electron-versions';

export class MockState {
  @observable public activeGistAction: GistActionState = GistActionState.none;
  @observable public closedPanels: Partial<
    Record<MosaicId, EditorBackup | true>
  > = {};
  @observable public currentDocsDemoPage: DocsDemoPage = DocsDemoPage.DEFAULT;
  @observable public customMosaics: CustomEditorId[] = [];
  @observable public genericDialogLastInput: string | null = null;
  @observable public genericDialogLastResult: boolean | null = null;
  @observable public gistId: string | undefined;
  @observable public isAutoBisecting = false;
  @observable public isConfirmationPromptShowing = false;
  @observable public isConsoleShowing = true;
  @observable public isGenericDialogShowing = false;
  @observable public isRunning = false;
  @observable public isSettingsShowing = false;
  @observable public isTokenDialogShowing = false;
  @observable public isUsingSystemTheme = true;
  @observable public isWarningDialogShowing = false;
  @observable public mosaicArrangement: MosaicNode<MosaicId> | null = null;
  @observable public output = [];
  @observable public theme: string | null;
  @observable public title = 'Electron Fiddle';
  @observable public version: string;
  @observable public versions: Record<string, RunnableVersion>;
  @observable public versionsToShow = [];

  public getAndRemoveEditorValueBackup = jest.fn();
  public hasVersion = jest.fn();
  public hideAndBackupMosaic = jest.fn();
  public hideChannels = jest.fn();
  public pushOutput = jest.fn();
  public removeCustomMosaic = jest.fn();
  public setGenericDialogOptions = jest.fn().mockReturnValue({});
  public setTheme = jest.fn();
  public setVersion = jest.fn();
  public showChannels = jest.fn();
  public showCustomEditorDialog = jest.fn();
  public showMosaic = jest.fn();
  public toggleGenericDialog = jest.fn();
  public toggleWarningDialog = jest.fn();


  public currentElectronVersion = new MockVersions().mockVersionsArray.shift()!;

  public Bisector = new BisectorMock();

  constructor() {
    const { mockVersions: obj, mockVersionsArray: arr } = new MockVersions();
    this.versions = obj;
    this.currentElectronVersion = arr[arr.length - 1];
    this.version = this.currentElectronVersion.version;
  }
}
