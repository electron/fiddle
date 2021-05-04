import { MonacoEditorMock } from './monaco-editor';
import { MosaicNode } from 'react-mosaic-component';

import { observable } from 'mobx';

import { EditorId } from '../../src/interfaces';
import { EditorBackup } from '../../src/renderer/editor-mosaic';

import { objectDifference } from '../utils';

export type Editor = MonacoEditorMock;

export class EditorMosaicMock {
  @observable public closedPanels: Record<EditorId, EditorBackup> = {};
  @observable public customMosaics: EditorId[] = [];
  @observable public editors: Map<EditorId, Editor> = new Map();
  @observable public isEdited = false;
  @observable public mosaicArrangement: MosaicNode<EditorId> | null = null;

  public addEditor = jest.fn();
  public getAndRemoveEditorValueBackup = jest.fn();
  public getEditorBackup = jest
    .fn()
    .mockImplementation((id) => this.closedPanels[id]);
  public getEditorValue = jest
    .fn()
    .mockImplementation((id) => this.editors.get(id)?.getValue() || '');
  public getEditorViewState = jest
    .fn()
    .mockImplementation((id) => this.editors.get(id)?.saveViewState() || null);
  public layout = jest.fn().mockImplementation(() => {
    this.editors.forEach((editor) => editor.layout());
  });
  public hideAndBackupMosaic = jest.fn();
  public removeCustomMosaic = jest.fn();
  public resetEditorLayout = jest.fn();
  public set = jest.fn();
  public setVisibleMosaics = jest.fn();
  public showMosaic = jest.fn();
  public values = jest.fn().mockReturnValue({});

  public toJSON() {
    const o = objectDifference(this, new EditorMosaicMock());
    return Object.keys(o).length === 0 ? 'default EditorMosaicMock' : o;
  }
}
