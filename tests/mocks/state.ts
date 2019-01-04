import { observable } from 'mobx';

export class MockState {
  @observable public isWarningDialogShowing = false;
}
