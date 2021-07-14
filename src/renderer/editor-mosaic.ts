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

  /** Reset the layout to the initial layout we had when set() was called */
  @action resetLayout = () => {
    this.set(this.values());
  };

  /// set / add / get the files in the model

  /** Set the contents of the mosaic */
  @action public set(valuesIn: EditorValues) {
    // set() clears out the previous Fiddle, so clear our previous state
    // except for this.editors -- we recycle editors below in setFile()
    this.backups.clear();
    this.customMosaics = [];
    this.mosaic = null;

    // add the files to the mosaic, recycling existing editors when possible.
    const values = new Map(Object.entries(valuesIn)) as Map<EditorId, string>;
    for (const [id, value] of values) this.addFile(id, value);
    for (const id of this.editors.keys()) {
      if (!values.has(id)) this.editors.delete(id);
    }

    this.isEdited = false;
  }

  /** Add a file. If we already have a file with that name, replace it. */
  @action private addFile(id: EditorId, value: string) {
    if (!isSupportedFile(id))
      throw new Error(`Cannot add file "${id}": Must be .js, .html, or .css`);

    // create a moncao model with the file's contents
    const { monaco } = window.ElectronFiddle;
    const language = monacoLanguage(id);
    const model = monaco.editor.createModel(value, language);
    model.updateOptions({ tabSize: 2 });

    // if we have an editor available, use the monaco model now.
    // otherwise, save the file in `this.backups` for future use.
    const backup: EditorBackup = { model };
    const editor = this.editors.get(id);
    if (editor) {
      this.setEditorFromBackup(editor, backup);
    } else {
      this.backups.set(id, backup);
    }

    // only show the file if it has nontrivial content
    if (value.length && value !== getEmptyContent(id)) {
      this.show(id);
    } else {
      this.hide(id);
    }
  }

  /// show or hide files in the view

  /** Show the specified file's editor */
  @action public show(id: EditorId) {
    this.setVisible([...getLeaves(this.mosaic), id]);
  }

  @action private setVisible(visible: EditorId[]) {
    // Sort the files and remove duplicates
    visible = [...new Set(visible)].sort(compareEditors);

    // Decide what layout would be good for this set of files
    const mosaic = EditorMosaic.createMosaic(visible);

    // Use that new layout. Note: if there are new files in `visible`,
    // setting `this.mosaic` here is what triggers new Monaco editors to
    // be created for them in React, via components/editors.tsx's use of
    // this.mosaic in its render() function. After they mount,
    // editors.tsx will call addEditor() to tell us about them. The same
    // holds true for removing editors; setting this.mosaic is what will
    // trigger their removal from React.
    this.mosaic = mosaic;
  }

  private static createMosaic(
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
      first: EditorMosaic.createMosaic(firstHalf, 'column'),
      second: EditorMosaic.createMosaic(secondHalf, 'column'),
    };
  }

  /** Helper to toggle visibility of the specified file's editor */
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

  /**
   * Removes the panel for a given custom EditorId.
   *
   * @param {EditorId} id
   */
  @action public removeCustomMosaic(id: EditorId) {
    this.hide(id);
    this.customMosaics = this.customMosaics.filter((mosaic) => mosaic !== id);
  }

  /** Wire up a newly-mounted Monaco editor */
  @action public addEditor(id: EditorId, editor: Editor) {
    const backup = this.backups.get(id);
    if (!backup) throw new Error(`added Editor for unexpected file "${id}"`);

    this.backups.delete(id);
    this.editors.set(id, editor);
    this.setEditorFromBackup(editor, backup);
  }

  /** Populate a MonacoEditor with the file's contents */
  @action private setEditorFromBackup(editor: Editor, backup: EditorBackup) {
    this.ignoreEdits(editor); // pause this so that isEdited doesn't get set
    if (backup.viewState) editor.restoreViewState(backup.viewState);
    editor.setModel(backup.model);
    this.observeEdits(editor); // resume
  }

  /** Add a new file to the mosaic */
  @action public addNewFile(id: EditorId, value: string = getEmptyContent(id)) {
    if (this.files.has(id))
      throw new Error(`Cannot add file "${id}": File already exists`);

    this.addFile(id, value);
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

  public layout = () => {
    const DEBOUNCE_MSEC = 50;
    if (!this.layoutDebounce) {
      this.layoutDebounce = setTimeout(() => {
        for (const editor of this.editors.values()) editor.layout();
        delete this.layoutDebounce;
      }, DEBOUNCE_MSEC);
    }
  };

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
