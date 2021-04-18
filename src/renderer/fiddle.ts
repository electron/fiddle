import * as MonacoType from 'monaco-editor';
import { App } from './app';
import { EditorId, EditorValues } from '../interfaces';
import { MosaicDirection, MosaicNode } from 'react-mosaic-component';
import { action, computed, observable, reaction } from 'mobx';
import { parse as pathParse } from 'path';
import {
  compareEditors,
  getEmptyContent,
  isSupportedFile,
} from '../utils/editor-utils';

export const enum EditorState {
  // The file is known to us but we've chosen not to show it.
  // The contents are cached offscreen.
  Hidden,

  // Space has been allocated in the mosaic for this file but the monaco
  // editor hasn't mounted yet. This is an interm step before 'Visible'.
  Pending,

  // The file's contents are visible in a Monaco editor in the mosaic.
  Visible,
}

export class Fiddle {
  @observable public isEdited = false;

  @computed public get states(): Map<EditorId, EditorState> {
    const { backups, pending, editors } = this;

    const states: Map<EditorId, EditorState> = new Map();
    for (const id of backups.keys()) states.set(id, EditorState.Hidden);
    for (const id of pending.keys()) states.set(id, EditorState.Pending);
    for (const id of editors.keys()) states.set(id, EditorState.Visible);

    const sortedIds = [...states.keys()].sort(compareEditors);
    return new Map(sortedIds.map((id) => [id, states.get(id)!]));
  }

  @computed private get ids(): EditorId[] {
    return [...this.states.keys()];
  }

  @computed public get mosaicLeafCount() {
    return this.pending.size + this.editors.size;
  }

  @observable public mosaic: MosaicNode<EditorId> | null = null;

  @observable private readonly backups: Map<EditorId, Backup>;
  @observable private readonly editors: Map<EditorId, IStandaloneCodeEditor>;
  @observable private readonly pending: Set<EditorId>;

  constructor(private readonly app: App) {
    this.editors = new Map();
    this.backups = new Map();
    this.pending = new Set();

    for (const actionName of [
      'add',
      'addEditor',
      'hide',
      'remove',
      'resetLayout',
      'restore',
      'set',
      'show',
      'showAll',
      'toggle',
    ]) {
      this[actionName] = this[actionName].bind(this);
    }

    // whenever the mosaics are changed,
    // upate the editor layout
    reaction(
      () => this.mosaic,
      () => this.layout(),
    );

    reaction(
      () => this.isEdited,
      (isEdited, wasEdited) => {
        if (!isEdited && wasEdited) {
          this.listenForEditsEverywhere();
        }
      },
    );
  }

  public values(): EditorValues {
    return Object.fromEntries(
      [...this.ids].map((id) => [id, this.getValue(id)]),
    );
  }

  @action public set(values: Partial<EditorValues>) {
    console.log('Editor: setting mosaics', Object.keys(values));

    this.isEdited = false;
    this.backups.clear();
    this.pending.clear();

    const removeMe = new Set(this.editors.keys());

    for (const entry of Object.entries(values)) {
      const id: EditorId = entry[0] as EditorId;
      removeMe.delete(id);

      const value = (entry[1] || '') as string;
      if (!isInterestingValue(id, value)) {
        // boring; hide it
        this.backups.set(id, { value });
        this.editors.delete(id);
        this.pending.delete(id);
      } else {
        const editor = this.editors.get(id);
        if (editor) {
          // reuse existing editor
          this.backups.delete(id);
          this.pending.delete(id);
          editor.setValue(value);
        } else {
          // queue up an editor to be populated later
          this.backups.set(id, { value });
          this.editors.delete(id);
          this.pending.add(id);
        }
      }
    }

    for (const id of removeMe) {
      this.editors.delete(id);
    }

    this.rebuildMosaic();
  }

  @action private rebuildMosaic() {
    const leaves = [...this.pending, ...this.editors.keys()];
    leaves.sort(compareEditors);
    this.mosaic = createMosaicArrangement(leaves);
  }

  @action public add(id: EditorId, value: string) {
    console.log(`Mosaics: add ${id}`);

    if (this.ids.includes(id)) {
      throw new Error(`Cannot add duplicate file "${id}"`);
    }
    if (!isSupportedFile(id)) {
      throw new Error('Name must be either an html, js, or css file.');
    }

    this.backups.set(id, { value: value || '' });
    this.pending.add(id);
    this.rebuildMosaic();
  }

  @action public hide(id: EditorId) {
    console.log(`Mosaics: hide ${id}`);
    const editor = this.editors.get(id);
    if (!editor) return;

    this.backups.set(id, this.createBackup(editor));
    this.editors.delete(id);
    this.rebuildMosaic();
  }

  @action public remove(id: EditorId) {
    console.log(`Mosaics: remove ${id}`);

    this.backups.delete(id);
    this.editors.delete(id);
    this.pending.delete(id);
    this.rebuildMosaic();
  }

  private createBackup(editor: IStandaloneCodeEditor): Backup {
    const model = editor.getModel() || undefined;
    const value = editor.getValue() || '';
    const viewState = editor.saveViewState() || undefined;
    return { model, value, viewState };
  }

  @action public show(id: EditorId) {
    console.log(`Mosaics: show ${id}`);
    if (this.editors.has(id)) return; // already visible?
    if (!this.backups.has(id)) return; // we don't have it?

    this.pending.add(id);
    this.rebuildMosaic();
  }

  @action public toggle(id: EditorId) {
    if (this.editors.has(id)) {
      this.hide(id);
    } else {
      this.show(id);
    }
  }

  @action public showAll() {
    this.backups.forEach((_, id) => this.show(id));
  }

  @action public resetLayout() {
    // FIXME: this one is wrong too
  }

  @action public restore(id: EditorId, editor: IStandaloneCodeEditor): boolean {
    const backup = this.backups.get(id);
    if (!backup) {
      return false;
    }

    this.backups.delete(id);

    if (backup.viewState) {
      editor.restoreViewState(backup.viewState);
    }
    if (backup.model) {
      editor.setModel(backup.model);
    } else {
      editor.setModel(this.createModel(id, backup.value ?? ''));
    }

    return true;
  }

  private createModel(filename: string, value: string) {
    const { monaco } = this.app;
    if (!monaco) throw new Error('monaco not loaded yet');

    const model = monaco.editor.createModel(value, getLanguage(filename));
    model.updateOptions({ tabSize: 2 });
    return model;
  }

  @action public addEditor(id: EditorId, editor: IStandaloneCodeEditor) {
    if (!this.pending.has(id))
      throw new Error(`Trying to add duplicate editor for file "${id}"`);

    console.log(`Editor: adding editor for ${id}`, this.editors.has(id));
    this.editors.set(id, editor);
    this.pending.delete(id);
    this.listenForEdits(editor);
  }

  private listenForEditsEverywhere() {
    for (const editor of this.editors.values()) {
      this.listenForEdits(editor);
    }
  }

  private listenForEdits(editor: IStandaloneCodeEditor) {
    const disposable = editor.onDidChangeModelContent(() => {
      // FIXME(ckerr) need to stop listening until we've set the values from backup
      // otherwise once it's changed it'll pretty much always show change
      console.log('i heard an edit');
      this.isEdited ||= true;
      disposable.dispose();
    });
  }

  public focusedEditor(): IStandaloneCodeEditor | undefined {
    for (const editor of this.editors.values()) {
      if (editor.hasTextFocus()) {
        return editor;
      }
    }
    return undefined;
  }

  public inspect() {
    if (!process.env.JEST_WORKER_ID)
      throw new Error('inspect() is for clear-box testing.');
    const { backups, editors, pending } = this;
    return { backups, editors, pending };
  }

  private getValue(id: EditorId) {
    return (
      this.backups.get(id)?.value || this.editors.get(id)?.getValue() || ''
    );
  }

  private layoutDebounce: any;

  public layout() {
    const DEBOUNCE_MSEC = 50;
    clearTimeout(this.layoutDebounce);
    this.layoutDebounce = setTimeout(() => {
      for (const editor of this.editors.values()) editor.layout();
      this.layoutDebounce = null;
    }, DEBOUNCE_MSEC);
  }

  public updateOptions(options: MonacoType.editor.IEditorOptions) {
    for (const editor of this.editors.values()) {
      editor.updateOptions(options);
    }
  }
}

type IStandaloneCodeEditor = MonacoType.editor.IStandaloneCodeEditor;

interface Backup {
  model?: MonacoType.editor.ITextModel | undefined;
  value: string;
  viewState?: MonacoType.editor.ICodeEditorViewState | undefined;
}

function createMosaicArrangement(
  input: readonly EditorId[],
  direction: MosaicDirection = 'row',
): MosaicNode<EditorId> | null {
  if (input.length === 0) return null;
  if (input.length === 1) return input[0];

  // This cuts out the first half of input. Input becomes the second half.
  const secondHalf = [...input];
  const firstHalf = secondHalf.splice(0, Math.floor(secondHalf.length / 2));

  return {
    direction,
    first: createMosaicArrangement(firstHalf, 'column')!,
    second: createMosaicArrangement(secondHalf, 'column')!,
  };
}

// FIXME(ckerr): this duplicates work in  editors.tsx.
// Where should it go?
// return a language name as recognized by
function getLanguage(filename: string) {
  const suffix = pathParse(filename).ext.slice(1);
  if (suffix === 'html') return 'html';
  if (suffix === 'css') return 'css';
  return 'javascript';
}

function isInterestingValue(id: EditorId, val: string) {
  return val && val.length > 0 && val !== getEmptyContent(id);
}
