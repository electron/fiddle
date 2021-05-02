import * as MonacoType from 'monaco-editor';
import { observable } from 'mobx';

import { EditorId } from '../interfaces';

export type Editor = MonacoType.editor.IStandaloneCodeEditor;

export class EditorMosaic {
  @observable public readonly editors: Map<EditorId, Editor> = new Map();
}
