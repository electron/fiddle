import { observable } from 'mobx';
import { EditorId, GistActionState } from '../../src/interfaces';

export class MockState {
  @observable public activeGistAction = GistActionState.none;
  @observable public allMosaics: EditorId[] = [];
  @observable public closedPanels = {};
  @observable public genericDialogLastInput: string | null = null;
  @observable public genericDialogLastResult: boolean | null = null;
  @observable public gistId = '';
  @observable public gitHubPublishAsPublic = true;
  @observable public gitHubToken: string | null = null;
  @observable public isConsoleShowing = true;
  @observable public isGenericDialogShowing = false;
  @observable public isUsingSystemTheme = true;
  @observable public output = [];
  @observable public title = 'Electron Fiddle';
  @observable public versionsToShow = [];

  public hasVersion = jest.fn();
  public hideChannels = jest.fn();
  public pushOutput = jest.fn();
  public setGenericDialogOptions = jest.fn();
  public setVersion = jest.fn();
  public setVisibleMosaics = jest.fn();
  public showChannels = jest.fn();
  public toggleAuthDialog = jest.fn();
}
