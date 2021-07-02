import { EditorPresence } from '../../src/renderer/editor-mosaic';
import { MonacoEditorMock } from './monaco';
import { observable } from 'mobx';
import { EditorId } from '../../src/interfaces';
import { objectDifference } from '../utils';

export type Editor = MonacoEditorMock;

export class EditorMosaicMock {
  @observable public customMosaics: EditorId[] = [];
  @observable public isEdited = false;
  @observable public numVisible = 0;
  @observable public files = new Map<EditorId, EditorPresence>();
  @observable private editors = new Map<EditorId, Editor>();

  public addEditor = jest.fn();
  public hide = jest.fn();
  public layout = jest.fn(() => this.editors.forEach((e) => e.layout()));
  public removeCustomMosaic = jest.fn();
  public resetLayout = jest.fn();
  public set = jest.fn();
  public show = jest.fn();
  public value = jest.fn((id) => this.editors.get(id)?.getValue() || '');
  public values = jest.fn().mockReturnValue({});

  public toJSON() {
    const o = objectDifference(this, new EditorMosaicMock());
    return Object.keys(o).length === 0 ? 'default EditorMosaicMock' : o;
  }
}
