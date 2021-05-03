import { MonacoEditorMock } from './monaco-editor';
import { MosaicNode } from 'react-mosaic-component';

import { observable } from 'mobx';

import { EditorId } from '../../src/interfaces';
import { EditorBackup } from '../../src/utils/editor-backup';

import { objectDifference } from '../utils';

export type Editor = MonacoEditorMock;

export class EditorMosaicMock {
  @observable public closedPanels: Record<EditorId, EditorBackup> = {};
  @observable public customMosaics: EditorId[] = [];
  @observable public editors: Map<EditorId, Editor> = new Map();
  @observable public mosaicArrangement: MosaicNode<EditorId> | null = null;

  public getAndRemoveEditorValueBackup = jest.fn();
  public getEditorValue = jest
    .fn()
    .mockImplementation((id) => this.editors.get(id)?.getValue() || '');
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
