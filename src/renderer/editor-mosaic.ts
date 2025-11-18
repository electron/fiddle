import { makeAutoObservable, reaction, runInAction } from 'mobx';
import * as MonacoType from 'monaco-editor';
import { MosaicDirection, MosaicNode, getLeaves } from 'react-mosaic-component';

import {
  compareEditors,
  getEmptyContent,
  isMainEntryPoint,
  isSupportedFile,
  monacoLanguage,
} from './utils/editor-utils';
import { EditorId, EditorValues, PACKAGE_NAME } from '../interfaces';

export type Editor = MonacoType.editor.IStandaloneCodeEditor;

/**
 * Editors in Electron Fiddle can be hidden from the current view, but
 * still exist in memory and can be re-opened.
 */
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
  public focusedFile: EditorId | null = null;

  /**
   * A map of editors and the SHA-1 hashes of their contents
   * when last saved.
   */
  private savedHashes = new Map<EditorId, string>();
  /**
   * A map of editors and the SHA-1 hashes of their current contents.
   */
  private currentHashes = new Map<EditorId, string>();

  public get isEdited() {
    // If we haven't processed the save state upon initial load yet, don't mark as edited
    // (All editors need to be mounted into Fiddle first)
    if (this.savedHashes.size === 0) {
      return false;
    }

    if (this.savedHashes.size !== this.currentHashes.size) {
      return true;
    }
    for (const [id, hash] of this.currentHashes) {
      if (this.savedHashes.get(id) !== hash) return true;
    }
    return false;
  }

  public get files() {
    const files = new Map<EditorId, EditorPresence>();

    const { backups, editors, mosaic } = this;
    for (const id of backups.keys()) files.set(id, EditorPresence.Hidden);
    for (const id of getLeaves(mosaic)) files.set(id, EditorPresence.Pending);
    for (const id of editors.keys()) files.set(id, EditorPresence.Visible);

    return files;
  }

  public get numVisible() {
    return getLeaves(this.mosaic).length;
  }

  // You probably want EditorMosaic.files instead.
  // This is only public because components/editors.tsx needs it
  public mosaic: MosaicNode<EditorId> | null = null;

  private readonly backups = new Map<EditorId, EditorBackup>();
  private readonly editors = new Map<EditorId, Editor>();

  constructor() {
    makeAutoObservable(this);

    // whenever the mosaics are changed,
    // update the editor layout
    reaction(
      () => this.mosaic,
      () => this.layout(),
    );
  }

  /** File is visible, focus file content */
  /** File is hidden, show the file and focus the file content */
  public setFocusedFile(id: EditorId) {
    this.focusedFile = id;
    if (this.files.get(this.focusedFile) === EditorPresence.Hidden) {
      this.show(this.focusedFile);
    }
    this.editors.get(id)?.focus();
  }

  /** Reset the layout to the initial layout we had when set() was called */
  public async resetLayout() {
    await this.set(this.values());
  }

  /// set / add / get the files in the model

  /** Set the contents of the mosaic */
  public async set(valuesIn: EditorValues) {
    // set() clears out the previous Fiddle, so clear our previous state
    // except for this.editors -- we recycle editors below in setFile()
    this.backups.clear();
    this.mosaic = null;

    // add the files to the mosaic, recycling existing editors when possible.
    const values = new Map(Object.entries(valuesIn)) as Map<EditorId, string>;
    for (const [id, value] of values) {
      await this.addFile(id, value);
    }
    for (const id of this.editors.keys()) {
      if (!values.has(id)) this.editors.delete(id);
    }

    // HACK: editors should be mounted shortly after we load something.
    // We could try waiting for every single `editorDidMount` callback
    // to fire, but that gets complicated with recycled editors with changed
    // values. This is just easier for now.
    await new Promise<void>((resolve) =>
      setTimeout(async () => {
        await this.markAsSaved();
        resolve();
      }, 100),
    );
  }

  /** Add a file. If we already have a file with that name, replace it. */
  private async addFile(id: EditorId, value: string) {
    if (
      id.endsWith('.json') &&
      [PACKAGE_NAME, 'package-lock.json'].includes(id)
    ) {
      throw new Error(
        `Cannot add ${PACKAGE_NAME} or package-lock.json as custom files`,
      );
    }

    if (!isSupportedFile(id)) {
      throw new Error(
        `Cannot add file "${id}": Must be .cjs, .js, .mjs, .html, .css, or .json`,
      );
    }

    // create a monaco model with the file's contents
    const { monaco } = window;
    const language = monacoLanguage(id);
    const model = monaco.editor.createModel(value, language);
    model.updateOptions({ tabSize: 2 });

    // if we have an editor available, use the monaco model now.
    // otherwise, save the file in `this.backups` for future use.
    const backup: EditorBackup = { model };
    this.backups.set(id, backup);

    const editor = this.editors.get(id);
    if (editor) {
      this.setEditorFromBackup(editor, backup);
      this.observeEdits(editor);
    }

    // only show the file if it has nontrivial content
    if (value.length && value !== getEmptyContent(id)) {
      this.show(id);
    } else {
      this.hide(id);
    }
    await this.updateCurrentHash();
  }

  /// show or hide files in the view

  /** Show the specified file's editor */
  public show(id: EditorId) {
    this.setVisible([...getLeaves(this.mosaic), id]);
  }

  private setVisible(visible: EditorId[]) {
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
  public toggle(id: EditorId) {
    if (this.files.get(id) === EditorPresence.Hidden) {
      this.show(id);
    } else {
      this.hide(id);
    }
  }

  /** Hide the specified file's editor */
  public hide(id: EditorId) {
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

  /** Remove the specified file and its editor */
  public async remove(id: EditorId) {
    this.editors.delete(id);
    this.backups.delete(id);
    this.setVisible(getLeaves(this.mosaic).filter((v) => v !== id));

    await this.updateCurrentHash();
  }

  /** Wire up a newly-mounted Monaco editor */
  public async addEditor(id: EditorId, editor: Editor) {
    const backup = this.backups.get(id);
    if (!backup) throw new Error(`added Editor for unexpected file "${id}"`);

    this.backups.delete(id);
    this.editors.set(id, editor);
    this.setEditorFromBackup(editor, backup);
  }

  /** Populate a MonacoEditor with the file's contents */
  private setEditorFromBackup(editor: Editor, backup: EditorBackup) {
    if (backup.viewState) editor.restoreViewState(backup.viewState);
    editor.setModel(backup.model);
    this.observeEdits(editor); // resume
  }

  /** Add a new file to the mosaic */
  public async addNewFile(id: EditorId, value: string = getEmptyContent(id)) {
    if (this.files.has(id)) {
      throw new Error(`Cannot add file "${id}": File already exists`);
    }

    const entryPoint = this.mainEntryPointFile();

    if (isMainEntryPoint(id) && entryPoint) {
      throw new Error(
        `Cannot add file "${id}": Main entry point ${entryPoint} exists`,
      );
    }

    await this.addFile(id, value);
  }

  /** Rename a file in the mosaic */
  public async renameFile(oldId: EditorId, newId: EditorId) {
    if (!this.files.has(oldId)) {
      throw new Error(`Cannot rename file "${oldId}": File doesn't exist`);
    }

    if (this.files.has(newId)) {
      throw new Error(`Cannot rename file to "${newId}": File already exists`);
    }

    const entryPoint = this.mainEntryPointFile();

    if (isMainEntryPoint(newId) && entryPoint !== oldId) {
      throw new Error(
        `Cannot rename file to "${newId}": Main entry point ${entryPoint} exists`,
      );
    }

    await this.addFile(newId, this.value(oldId).trim());
    await this.remove(oldId);
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

  public mainEntryPointFile(): EditorId | undefined {
    return Array.from(this.files.keys()).find((id) => isMainEntryPoint(id));
  }

  private observeEdits(editor: Editor) {
    editor.onDidChangeModelContent(async () => {
      await this.updateCurrentHash();
    });
  }

  private async updateCurrentHash() {
    const hashes = await this.getAllHashes();
    runInAction(() => {
      this.currentHashes = hashes;
    });
  }

  /**
   * Generates a SHA-1 hash for each editor's contents. Visible editors are
   * under `this.editors`, and hidden editors are under `this.backups`.
   */
  private async getAllHashes() {
    const hashes = new Map<EditorId, string>();
    const encoder = new TextEncoder();

    for (const [id, editor] of this.editors) {
      const txt = editor.getModel()?.getValue();
      const data = encoder.encode(txt);
      const digest = await window.crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(digest));
      const hash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      hashes.set(id, hash);
    }

    for (const [id, backup] of this.backups) {
      const txt = backup.model.getValue();
      const data = encoder.encode(txt);
      const digest = await window.crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(digest));
      const hash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      hashes.set(id, hash);
    }

    return hashes;
  }

  /**
   * Marks the current state of all editors as saved.
   */
  public async markAsSaved() {
    const hashes = await this.getAllHashes();
    runInAction(() => {
      this.savedHashes = hashes;
      // new map to clone
      this.currentHashes = new Map(hashes);
    });
  }

  /**
   * Forces all editors to be marked as unsaved.
   */
  public clearSaved() {
    this.savedHashes.clear();
  }
}
