import * as MonacoType from 'monaco-editor';
import { MosaicDirection, MosaicNode, getLeaves } from 'react-mosaic-component';
import { action, computed, observable, reaction } from 'mobx';
import { DefaultEditorId, EditorId, EditorValues } from '../interfaces';

import {
  compareEditors,
  getEmptyContent,
  isKnownFile,
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

/**
 * Create a mosaic arrangement given an array of editor ids.
 *
 * @export
 * @param {Array<EditorId>} input
 * @returns {MosaicNode<EditorId>}
 */
export function createMosaicArrangement(
  input: EditorId[],
  direction: MosaicDirection = 'row',
): MosaicNode<EditorId> {
  if (input.length < 2) return input[0];

  // This cuts out the first half of input. Input becomes the second half.
  const secondHalf = [...input];
  const firstHalf = secondHalf.splice(0, Math.floor(secondHalf.length / 2));

  return {
    direction,
    first: createMosaicArrangement(firstHalf, 'column'),
    second: createMosaicArrangement(secondHalf, 'column'),
  };
}

interface EditorBackup {
  value?: string;
  viewState?: MonacoType.editor.ICodeEditorViewState | null;
}

export class EditorMosaic {
  @observable public customMosaics: EditorId[] = [];
  @observable public isEdited = false;
  @observable public mosaicArrangement: MosaicNode<EditorId> | null;

  @computed public get files() {
    const { backups, editors, mosaicArrangement: mosaic } = this;

    const files: Map<EditorId, EditorPresence> = new Map();
    for (const id of backups.keys()) files.set(id, EditorPresence.Hidden);
    for (const id of getLeaves(mosaic)) files.set(id, EditorPresence.Pending);
    for (const id of editors.keys()) files.set(id, EditorPresence.Visible);
    return files;
  }

  @computed public get numVisible() {
    return getLeaves(this.mosaicArrangement).length;
  }

  @observable private readonly backups: Map<EditorId, EditorBackup> = new Map();
  @observable private readonly editors: Map<EditorId, Editor> = new Map();

  constructor() {
    for (const name of [
      'hide',
      'ignoreAllEdits',
      'ignoreEdits',
      'layout',
      'observeAllEdits',
      'observeEdits',
      'removeCustomMosaic',
      'resetLayout',
      'set',
      'show',
      'toggle',
      'values',
    ]) {
      this[name] = this[name].bind(this);
    }

    // whenever the mosaics are changed,
    // upate the editor layout
    reaction(
      () => this.mosaicArrangement,
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

  @action private setVisible(visible: EditorId[]) {
    console.log('setVisible', JSON.stringify(visible));
    const { backups, editors } = this;

    // cache and remove any unwanted editors
    for (const [id, editor] of editors) {
      if (!visible.includes(id)) {
        backups.set(id, { viewState: editor.saveViewState() });
        editors.delete(id);
      }
    }

    const updatedArrangement = createMosaicArrangement(
      visible.sort(compareEditors),
    );
    console.log(
      `State: Setting visible mosaic panels`,
      visible,
      updatedArrangement,
    );

    this.mosaicArrangement = updatedArrangement;
  }

  /**
   * Hides the panel for a given EditorId.
   *
   * @param {EditorId} id
   */
  @action public hide(id: EditorId) {
    this.setVisible(this.getVisibleMosaics().filter((v) => v !== id));
  }

  @action public toggle(id: EditorId) {
    if (this.files.get(id) === EditorPresence.Hidden) {
      this.show(id);
    } else {
      this.hide(id);
    }
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

  /**
   * Shows the editor value for a given editor.
   *
   * @param {EditorId} id
   */
  @action public show(id: EditorId) {
    this.setVisible([...this.getVisibleMosaics(), id]);
  }

  /**
   * Resets editor view to default layout.
   */
  @action public resetLayout() {
    this.set(this.values());
  }

  @action public set(values: EditorValues) {
    // Remove all previously created custom editors.
    this.customMosaics = Object.keys(values).filter(
      (filename: string) => !isKnownFile(filename),
    ) as EditorId[];

    // If the gist content is empty or matches the empty file output, don't show it.
    const shouldShow = (id: EditorId, val?: string) => {
      return !!val && val.length > 0 && val !== getEmptyContent(id);
    };

    // Sort and display all editors that have content.
    const visibleEditors: EditorId[] = Object.entries(values)
      .filter(([id, content]) => shouldShow(id as EditorId, content as string))
      .map(([id]) => id as DefaultEditorId)
      .sort(compareEditors);

    // Once loaded, we have a "saved" state.
    this.setVisible(visibleEditors);

    // Set content for mosaics.
    for (const [name, value] of Object.entries(values)) {
      const editor = this.editors.get(name as EditorId);
      if (!editor) {
        this.backups.set(name as EditorId, { value: value as string });
      } else if (editor.getValue() !== value) {
        this.ignoreEdits(editor);
        editor.setValue(value as string);
        this.observeEdits(editor);
      }
    }

    this.isEdited = false;
  }

  @action public addEditor(id: EditorId, editor: Editor) {
    this.editors.set(id, editor);

    const backup = this.backups.get(id);
    delete this.backups[id];
    if (backup?.viewState) {
      editor.restoreViewState(backup.viewState);
    } else {
      const { monaco } = window.ElectronFiddle;
      const value = backup?.value ?? '';
      const language = monacoLanguage(id);
      const model = monaco.editor.createModel(value, language);
      model.updateOptions({ tabSize: 2 });
      editor.setModel(model);
    }

    this.observeEdits(editor);
  }

  /**
   * Retrieves the contents of all files.
   *
   * @returns {EditorValues}
   */
  public values(): EditorValues {
    const values: EditorValues = {};
    for (const id of this.backups.keys()) values[id] = this.getEditorValue(id);
    for (const id of this.editors.keys()) values[id] = this.getEditorValue(id);
    return values;
  }

  /**
   * Return the contents of the specified file
   *
   * @param {EditorId} id
   * @returns {string}
   */
  public getEditorValue(id: EditorId): string {
    const { backups, editors } = this;
    return editors.get(id)?.getValue() || backups.get(id)?.value || '';
  }

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

  private getVisibleMosaics(): EditorId[] {
    return getLeaves(this.mosaicArrangement);
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
