import * as MonacoType from 'monaco-editor';
import { MosaicDirection, MosaicNode, getLeaves } from 'react-mosaic-component';
import { action, computed, observable, reaction } from 'mobx';
import { EditorId, EditorValues } from '../interfaces';

import {
  compareEditors,
  getEmptyContent,
  isSupportedFile,
  monacoLanguage,
} from '../utils/editor-utils';

export type Editor = MonacoType.editor.IStandaloneCodeEditor;

export enum EditorPresence {
  /** The file is known to us but we've chosen not to show it, either
      because the content was boring or because hide() was called.
      Its contents are cached offscreen. */
  Hidden,

  /** Space has been allocated for this file in the mosaic but the
      monaco editor has not mounted in React yet. This is an interim
      state before the editor is Visible. */
  Pending,

  /** The file is visible in one of the mosaic's monaco editors */
  Visible,
}

interface EditorBackup {
  model: MonacoType.editor.ITextModel;
  viewState?: MonacoType.editor.ICodeEditorViewState | null;
}

export class EditorMosaic {
  @observable public customMosaics: EditorId[] = [];
  @observable public isEdited = false;

  @computed public get files() {
    const files = new Map<EditorId, EditorPresence>();

    const { backups, editors, mosaic } = this;
    for (const id of backups.keys()) files.set(id, EditorPresence.Hidden);
    for (const id of getLeaves(mosaic)) files.set(id, EditorPresence.Pending);
    for (const id of editors.keys()) files.set(id, EditorPresence.Visible);

    return files;
  }

  @computed public get numVisible() {
    return getLeaves(this.mosaic).length;
  }

  // You probably want EditorMosaic.files instead.
  // This is only public because components/editors.tsx needs it
  @observable public mosaic: MosaicNode<EditorId> | null = null;

  @observable private readonly backups = new Map<EditorId, EditorBackup>();
  @observable private readonly editors = new Map<EditorId, Editor>();

  constructor() {
    // whenever the mosaics are changed,
    // upate the editor layout
    reaction(
      () => this.mosaic,
      () => this.layout(),
    );

    // whenever isEdited is set, stop or start listening to edits again.
    reaction(
      () => this.isEdited,
      () => {
        if (this.isEdited) {
          this.ignoreAllEdits();
        } else {
          this.observeAllEdits();
        }
      },
    );
  }

  /// show or hide files in the view

  /** Toggle visibility of the specified file's editor */
  @action public toggle(id: EditorId) {
    if (this.files.get(id) === EditorPresence.Hidden) {
      this.show(id);
    } else {
      this.hide(id);
    }
  }

  /** Hide the specified file's editor */
  @action public hide(id: EditorId) {
    const editor = this.editors.get(id);
    if (editor) {
      this.editors.delete(id);
      this.backups.set(id, {
        model: editor.getModel()!,
        viewState: editor.saveViewState(),
      });
    }

    this.setVisible(getLeaves(this.mosaic).filter((v) => v !== id));
  }

  /** Show the specified file's editor */
  @action public show(id: EditorId) {
    this.setVisible([...getLeaves(this.mosaic), id]);
  }

  @action private setVisible(visible: EditorId[]) {
    this.mosaic = EditorMosaic.CreateMosaic(
      [...new Set(visible)].sort(compareEditors),
    );
  }

  private static CreateMosaic(
    input: EditorId[],
    direction: MosaicDirection = 'row',
  ): MosaicNode<EditorId> {
    // Return single editor or undefined.
    if (input.length < 2) return input[0];

    // This cuts out the first half of input. Input becomes the second half.
    const secondHalf = [...input];
    const firstHalf = secondHalf.splice(0, Math.floor(secondHalf.length / 2));

    return {
      direction,
      first: EditorMosaic.CreateMosaic(firstHalf, 'column'),
      second: EditorMosaic.CreateMosaic(secondHalf, 'column'),
    };
  }

  /**
   * Removes the panel for a given custom EditorId.
   *
   * @param {EditorId} id
   */
  @action public removeCustomMosaic(id: EditorId) {
    this.hide(id);
    this.customMosaics = this.customMosaics.filter((mosaic) => mosaic !== id);
  }

  /** Reset the mosaic's layout back to the default */
  @action public resetLayout() {
    this.set(this.values());
  }

  /// set / add / get the files in the model

  /** Set the contents of the mosaic */
  @action public set(valuesIn: EditorValues) {
    const values = new Map(Object.entries(valuesIn)) as Map<EditorId, string>;
    this.backups.clear();
    this.customMosaics = [];
    this.mosaic = null;
    for (const [id, value] of values) this.addOrReplace(id, value);
    this.isEdited = false;
  }

  /** Add a new file to the mosaic */
  @action public addNew(id: EditorId, value: string = getEmptyContent(id)) {
    if (this.files.has(id))
      throw new Error(`Cannot add file "${id}": File already exists`);

    this.addOrReplace(id, value);
  }

  /** Add a file to the mosaic, replacing the existing file if present */
  @action private addOrReplace(id: EditorId, value: string) {
    if (!isSupportedFile(id))
      throw new Error(`Cannot add file "${id}": Must be .js, .html, or .css`);

    this.setValue(id, value);

    if (value.length && value !== getEmptyContent(id)) this.show(id);
  }

  @action private setValue(id: EditorId, value: string) {
    // create a new model
    const { monaco } = window.ElectronFiddle;
    const language = monacoLanguage(id);
    const model = monaco.editor.createModel(value, language);
    model.updateOptions({ tabSize: 2 });

    // if we have an editor, use the model now.
    // otherwise, cache it in `backups` for later.
    const backup: EditorBackup = { model };
    const editor = this.editors.get(id);
    if (editor) {
      this.restoreEditor(editor, backup);
    } else {
      this.backups.set(id, backup);
    }
  }

  /** Wire up a newly-mounted monaco editor */
  @action public addEditor(id: EditorId, editor: Editor) {
    const backup = this.backups.get(id);
    if (!backup) throw new Error(`added Editor for unexpected file "${id}"`);

    this.backups.delete(id);
    this.editors.set(id, editor);
    this.restoreEditor(editor, backup);
  }

  /** Set an editor's model and viewState */
  @action private restoreEditor(editor: Editor, backup: EditorBackup) {
    this.ignoreEdits(editor);
    if (backup.viewState) editor.restoreViewState(backup.viewState);
    editor.setModel(backup.model);
    this.observeEdits(editor);
  }

  /** Get the contents of a single file. */
  public value(id: EditorId): string {
    const { backups, editors } = this;
    return (
      editors.get(id)?.getValue() || backups.get(id)?.model.getValue() || ''
    );
  }

  /** Get the contents of all files. */
  public values(): EditorValues {
    return Object.fromEntries(
      [...this.files].map(([id]) => [id, this.value(id)]),
    );
  }

  /// misc utilities

  private layoutDebounce: ReturnType<typeof setTimeout> | undefined;

  public layout() {
    const DEBOUNCE_MSEC = 50;
    if (!this.layoutDebounce) {
      this.layoutDebounce = setTimeout(() => {
        for (const editor of this.editors.values()) editor.layout();
        delete this.layoutDebounce;
      }, DEBOUNCE_MSEC);
    }
  }

  public focusedEditor(): Editor | undefined {
    return [...this.editors.values()].find((editor) => editor.hasTextFocus());
  }

  public updateOptions(options: MonacoType.editor.IEditorOptions) {
    for (const editor of this.editors.values()) editor.updateOptions(options);
  }

  //=== Listen for user edits

  private ignoreAllEdits() {
    for (const editor of this.editors.values()) this.ignoreEdits(editor);
  }

  private ignoreEdits(editor: Editor) {
    editor.onDidChangeModelContent(() => {
      // no-op
    });
  }

  private observeAllEdits() {
    for (const editor of this.editors.values()) this.observeEdits(editor);
  }

  private observeEdits(editor: Editor) {
    const disposable = editor.onDidChangeModelContent(() => {
      this.isEdited ||= true;
      disposable.dispose();
    });
  }
}
