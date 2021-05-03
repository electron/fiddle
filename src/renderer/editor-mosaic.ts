// external dependencies
import * as MonacoType from 'monaco-editor';
import { MosaicNode } from 'react-mosaic-component';
import { action, observable } from 'mobx';

// app deps
import { EditorBackup, getEditorBackup } from '../utils/editor-backup';
import {
  createMosaicArrangement,
  getVisibleMosaics,
} from '../utils/editors-mosaic-arrangement';
import { DEFAULT_CLOSED_PANELS, DEFAULT_MOSAIC_ARRANGEMENT } from './constants';
import { DEFAULT_EDITORS, EditorId } from '../interfaces';
import { waitForEditorsToMount } from '../utils/editor-mounted';

export type Editor = MonacoType.editor.IStandaloneCodeEditor;

export class EditorMosaic {
  @observable public readonly editors: Map<EditorId, Editor> = new Map();
  @observable public customMosaics: EditorId[] = [];
  @observable
  public mosaicArrangement: MosaicNode<EditorId> | null = DEFAULT_MOSAIC_ARRANGEMENT;
  @observable public closedPanels: Record<
    EditorId,
    EditorBackup
  > = DEFAULT_CLOSED_PANELS;

  constructor() {
    for (const name of [
      'getAndRemoveEditorValueBackup',
      'hideAndBackupMosaic',
      'removeCustomMosaic',
      'resetEditorLayout',
      'setVisibleMosaics',
      'showMosaic',
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
        this.closedPanels[id] = getEditorBackup(id);
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
  //  --->
  @action public resetEditorLayout() {
    this.mosaicArrangement = DEFAULT_MOSAIC_ARRANGEMENT;
  }
}
