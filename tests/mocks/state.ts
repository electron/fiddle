import { observable } from 'mobx';

export class MockState {
  @observable public closedPanels = {};
  @observable public gistId = '';
  @observable public isConsoleShowing = true;
  @observable public isGenericDialogShowing = false;
  @observable public isUsingSystemTheme = true;
  @observable public output = [];
}
