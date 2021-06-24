import { MonacoEditorMock } from './monaco-editor';

import { observable } from 'mobx';

import { EditorId } from '../../src/interfaces';

import { objectDifference } from '../utils';

export type Editor = MonacoEditorMock;

export class EditorMosaicMock {
  @observable public customMosaics: EditorId[] = [];
  @observable public editors: Map<EditorId, Editor> = new Map();
  @observable public isEdited = false;
  @observable public numVisible = 0;

  public addEditor = jest.fn();
  public getEditorValue = jest
    .fn()
    .mockImplementation((id) => this.editors.get(id)?.getValue() || '');
  public getEditorViewState = jest
    .fn()
    .mockImplementation((id) => this.editors.get(id)?.saveViewState() || null);
  public layout = jest.fn().mockImplementation(() => {
    this.editors.forEach((editor) => editor.layout());
  });
  public hide = jest.fn();
  public removeCustomMosaic = jest.fn();
  public resetLayout = jest.fn();
  public set = jest.fn();
  public show = jest.fn();
  public values = jest.fn().mockReturnValue({});

  public toJSON() {
    const o = objectDifference(this, new EditorMosaicMock());
    return Object.keys(o).length === 0 ? 'default EditorMosaicMock' : o;
  }
}
