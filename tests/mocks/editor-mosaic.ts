import { observable } from 'mobx';

export class EditorMosaicMock {
  @observable public isEdited = false;
  public showAll = jest.fn();
  public addEditor = jest.fn();
}
