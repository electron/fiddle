import * as MonacoType from 'monaco-editor';
import { MosaicNode } from 'react-mosaic-component';
import { action, observable } from 'mobx';

import {
  createMosaicArrangement,
  getVisibleMosaics,
} from '../utils/editors-mosaic-arrangement';
import { DEFAULT_MOSAIC_ARRANGEMENT } from './constants';
import {
  DEFAULT_EDITORS,
  DefaultEditorId,
  EditorId,
  EditorValues,
} from '../interfaces';
import { waitForEditorsToMount } from '../utils/editor-mounted';
import { getEditorModel } from '../utils/editor-model';
import {
  compareEditors,
  getEmptyContent,
  isKnownFile,
} from '../utils/editor-utils';

export type Editor = MonacoType.editor.IStandaloneCodeEditor;

export interface EditorBackup {
  value?: string;
  model?: MonacoType.editor.ITextModel | null;
  viewState?: MonacoType.editor.ICodeEditorViewState | null;
}

export class EditorMosaic {
  @observable public readonly editors: Map<EditorId, Editor> = new Map();
  @observable public customMosaics: EditorId[] = [];
  @observable
  public mosaicArrangement: MosaicNode<EditorId> | null = DEFAULT_MOSAIC_ARRANGEMENT;
  @observable public closedPanels: Record<EditorId, EditorBackup> = {};

  constructor() {
    for (const name of [
      'getAndRemoveEditorValueBackup',
      'hideAndBackupMosaic',
      'removeCustomMosaic',
      'resetEditorLayout',
      'set',
      'setVisibleMosaics',
      'showMosaic',
      'values',
    ]) {
      this[name] = this[name].bind(this);
    }
  }

  /**
   * Sets the editor value for a given editor. Deletes the value after
   * accessing it.
   *
   * @param {EditorId} id
   */
  @action public getAndRemoveEditorValueBackup(
    id: EditorId,
  ): EditorBackup | null {
    const value = this.closedPanels[id];
    delete this.closedPanels[id];
    return value;
  }

  @action public async setVisibleMosaics(visible: Array<EditorId>) {
    const { editors, mosaicArrangement } = this;
    const currentlyVisible = getVisibleMosaics(mosaicArrangement);

    for (const id of DEFAULT_EDITORS) {
      if (!visible.includes(id) && currentlyVisible.includes(id)) {
        this.closedPanels[id] = this.getEditorBackup(id);
        // if we have backup, remove active editor
        editors.delete(id);
      }
    }

    const updatedArrangement = createMosaicArrangement(visible);
    console.log(
      `State: Setting visible mosaic panels`,
      visible,
      updatedArrangement,
    );

    this.mosaicArrangement = updatedArrangement;

    // after the mosaicArrangement loads, we want to wait for the Mosaic editors to
    // mount to ensure that we can load content into the editors as soon as they're
    // declared visible.

    await waitForEditorsToMount(visible);
  }

  /**
   * Hides the panel for a given EditorId.
   *
   * @param {EditorId} id
   */
  @action public hideAndBackupMosaic(id: EditorId) {
    const currentlyVisible = getVisibleMosaics(this.mosaicArrangement);
    this.setVisibleMosaics(currentlyVisible.filter((v) => v !== id));
  }

  /**
   * Removes the panel for a given custom EditorId.
   *
   * @param {EditorId} id
   */
  @action public removeCustomMosaic(id: EditorId) {
    this.hideAndBackupMosaic(id);
    this.editors.delete(id);
    this.customMosaics = this.customMosaics.filter((mosaic) => mosaic !== id);
  }

  /**
   * Shows the editor value for a given editor.
   *
   * @param {EditorId} id
   */
  @action public showMosaic(id: EditorId) {
    const currentlyVisible = getVisibleMosaics(this.mosaicArrangement);
    this.setVisibleMosaics([...currentlyVisible, id]);
  }

  /**
   * Resets editor view to default layout.
   *
   *
   */
  @action public resetEditorLayout() {
    this.mosaicArrangement = DEFAULT_MOSAIC_ARRANGEMENT;
  }

  @action public async set(editorValues: EditorValues) {
    // Remove all previously created custom editors.
    this.customMosaics = Object.keys(editorValues).filter(
      (filename: string) => !isKnownFile(filename),
    ) as EditorId[];

    // If the gist content is empty or matches the empty file output, don't show it.
    const shouldShow = (id: EditorId, val?: string) => {
      return !!val && val.length > 0 && val !== getEmptyContent(id);
    };

    // Sort and display all editors that have content.
    const visibleEditors: EditorId[] = Object.entries(editorValues)
      .filter(([id, content]) => shouldShow(id as EditorId, content as string))
      .map(([id]) => id as DefaultEditorId)
      .sort(compareEditors);

    // Once loaded, we have a "saved" state.
    await this.setVisibleMosaics(visibleEditors);

    // Set content for mosaics.
    for (const [name, value] of Object.entries(editorValues)) {
      const editor = this.editors.get(name as EditorId);
      if (editor) {
        // The editor exists, set the value directly
        if (editor.getValue() !== value) {
          editor.setValue(value as string);
        }
      } else {
        // The editor does not exist, attempt to set it on the backup.
        // If there's a model, we'll do it on the model. Else, we'll
        // set the value.
        let backup = this.closedPanels[name];
        if (!backup) {
          backup = { value };
          this.closedPanels[name] = backup;
        } else if (backup.model) {
          backup.model.setValue(value);
        } else {
          backup.value = value;
        }
      }
    }
  }

  /**
   * Retrieves the contents of all editor panes.
   *
   * @returns {EditorValues}
   */
  public values(): EditorValues {
    const values: EditorValues = {};

    for (const name of Object.keys(this.closedPanels)) {
      values[name] = this.getEditorValue(name as EditorId);
    }

    for (const name of this.editors.keys()) {
      values[name] = this.getEditorValue(name);
    }

    return values;
  }

  /**
   * Return the value for a given editor
   *
   * @param {EditorId} id
   * @returns {string}
   */
  public getEditorValue(id: EditorId): string {
    const editor = this.editors.get(id);
    console.log('getEditorValue', !!editor, editor?.getValue());
    if (editor) return editor.getValue();

    const backup = this.closedPanels[id];
    if (backup?.value) return backup.value;

    return '';
  }

  /**
   * Returns a backup for a given editor
   *
   * @param {EditorId} id
   * @returns {EditorBackup}
   */
  public getEditorBackup(id: EditorId): EditorBackup {
    return {
      value: this.getEditorValue(id),
      model: getEditorModel(id),
      viewState: this.getEditorViewState(id),
    };
  }

  /**
   * Returns the view state for a given editor.
   *
   * @export
   * @param {EditorId} id
   * @returns {(editor.ICodeEditorViewState | null)}
   */
  public getEditorViewState(
    id: EditorId,
  ): MonacoType.editor.ICodeEditorViewState | null {
    return this.editors.get(id)?.saveViewState() || null;
  }
}
