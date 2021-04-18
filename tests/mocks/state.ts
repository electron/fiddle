import { observable } from 'mobx';
import { EditorId } from '../../src/interfaces';

export class MockState {
  @observable public allMosaics: EditorId[] = [];
  @observable public closedPanels = {};
  @observable public gistId = '';
  @observable public isConsoleShowing = true;
  @observable public isGenericDialogShowing = false;
  @observable public isUsingSystemTheme = true;
  @observable public output = [];
  @observable public title = 'Electron Fiddle';
  @observable public versionsToShow = [];

  public hasVersion = jest.fn();
  public hideChannels = jest.fn();
  public pushOutput = jest.fn();
  public setVersion = jest.fn();
  public setVisibleMosaics = jest.fn();
  public showChannels = jest.fn();
}
