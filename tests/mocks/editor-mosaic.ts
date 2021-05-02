import { MonacoEditorMock } from './monaco-editor';
import { observable } from 'mobx';

import { EditorId } from '../../src/interfaces';

export type Editor = MonacoEditorMock;

export class EditorMosaicMock {
  @observable public readonly editors: Map<EditorId, Editor> = new Map();
}
