import { observable } from 'mobx';

export class MockState {
  @observable public isWarningDialogShowing = false;
  @observable public gistId = '';
  @observable public closedPanels = {};
}
