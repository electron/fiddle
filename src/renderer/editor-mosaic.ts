import * as MonacoType from 'monaco-editor';
import { App } from './app';
import { EditorId, EditorValues } from '../interfaces';
import {
  MosaicNode,
  createBalancedTreeFromLeaves,
} from 'react-mosaic-component';
import { action, computed, observable, reaction } from 'mobx';
import {
  compareEditors,
  getEmptyContent,
  isSupportedFile,
  monacoLanguage,
} from '../utils/editor-utils';

type IStandaloneCodeEditor = MonacoType.editor.IStandaloneCodeEditor;

/**
 * The state of a file in the mosaic editor.
 * @readonly
 * @enum
 * @see EditorMosaic.states
 */
export const enum EditorState {
  /** The file is known to us but we've chosen not to show it.
      Its contents are cached offscreen. */
  Hidden,

  /** Space has been allocated in the mosaic for this file but the monaco
      editor hasn't mounted yet. This is an interm step before 'Visible'. */
  Pending,

  /** The file's contents are visible in a Monaco editor in the mosaic. */
  Visible,
}

export type EditorStates = Map<EditorId, EditorState>;

interface Backup {
  model?: MonacoType.editor.ITextModel | undefined;
  value: string;
  viewState?: MonacoType.editor.ICodeEditorViewState | undefined;
}

interface EditorData {
  backup?: Backup;
  editor?: IStandaloneCodeEditor;
  pending?: boolean;
}

export class EditorMosaic {
  /**
   * Tracks whether or not the editor mosaic has unsaved changes.
   *
   * @public
   * @type {boolean}
   * @memberof EditorMosaic
   */
  @observable public isEdited = false;

  /**
   * The states of all the files in the editor mosaic.
   *
   * @public
   * @type {EditorStates}
   * @see EditorState
   * @memberof EditorMosaic
   */
  @computed public get states(): EditorStates {
    const states: EditorStates = new Map();

    for (const [id, data] of this.ids) {
      if (data.editor) {
        states.set(id, EditorState.Visible);
      } else if (data.pending) {
        states.set(id, EditorState.Pending);
      } else {
        states.set(id, EditorState.Hidden);
      }
    }

    return states;
  }

  /**
   * The root node of the editor mosaic, for consumption by the editors
   * component
   *
   * @public
   * @type {MosaicNode<EditorId> | null>
   * @memberof EditorMosaic
   */
  @observable public mosaic: MosaicNode<EditorId> | null = null;

  /**
   * The ids that currently have a spot in the editor mosaic,
   * either currently active (EditorState.visible) or about to be
   * as soon as a monaco editor mounts (EditorState.pending).
   *
   * @private
   * @type {EditorId[]}
   * @memberof EditorMosaic
   */
  @computed private get leaves(): EditorId[] {
    const leaves = [];
    for (const [id, data] of this.ids) {
      if (data.pending || data.editor) {
        leaves.push(id);
      }
    }
    return leaves;
  }

  /**
   * The number of leaves currently in the editor mosaic.
   *
   * @public
   * @type {number}
   * @memberof EditorMosaic
   */
  @computed public get mosaicLeafCount(): number {
    return this.leaves.length;
  }

  /**
   * Implementation data on the files in the editor mosaic.
   *
   * @private
   * @memberof EditorMosaic
   */
  @observable private readonly ids: Map<EditorId, EditorData> = new Map();

  constructor(private readonly app: App) {
    for (const name of [
      'add',
      'addEditor',
      'hide',
      'ignoreAllEdits',
      'ignoreEdits',
      'observeAllEdits',
      'observeEdits',
      'remove',
      'resetLayout',
      'restore',
      'set',
      'show',
      'showAll',
      'toggle',
    ]) {
      this[name] = this[name].bind(this);
    }

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

  //=== Set / Add / Remove files

  /**
   * Set the contents of the mosaic filter, replacing any previous contents.
   *
   * @function set
   * @public
   * @param {Partial<EditorValues>} values - the files to be added
   * @memberof EditorMosaic
   */
  @action public set(values: Partial<EditorValues>) {
    console.log('EditorMosaic: setting mosaics', Object.keys(values));

    // show files whose content is nonempty and is also
    // different from the placeholder empty content
    const shouldShow = (id: EditorId, val: string) => {
      return !!val && val.length > 0 && val !== getEmptyContent(id);
    };

    this.isEdited = false;

    const removeMe = new Set(this.ids.keys());

    for (const entry of Object.entries(values)) {
      const id = entry[0] as EditorId;
      const value = (entry[1] || '') as string;

      removeMe.delete(id as EditorId);

      if (!shouldShow(id, value)) {
        // don't want it
        this.ids.set(id, { backup: { value } });
      } else {
        const data = this.ids.get(id);
        if (data?.editor) {
          // we want it + have a place for it
          this.ignoreEdits(data.editor);
          data.editor.setValue(value);
        } else {
          // we want it but need an editor for it first
          this.ids.set(id, {
            backup: { value },
            pending: true,
          });
        }
      }
    }

    for (const id of removeMe) this.ids.delete(id);

    this.isEdited = false;
    this.rebuildMosaic();
  }

  /**
   * Adds a new file to the editor mosaic.
   *
   * @function add
   * @public
   * @param {EditorId} id - the file to add
   * @param {string} text - the file's contents
   * @throws Will throw an Error if the file cannot be added
   */
  @action public add(id: EditorId, value: string) {
    console.log(`EditorMosaic: add ${id}`);

    if (this.ids.has(id)) {
      throw new Error(`Cannot add duplicate file "${id}"`);
    }
    if (!isSupportedFile(id)) {
      throw new Error('File must be either js, html, or css.');
    }

    this.ids.set(id, {
      backup: { value: value || '' },
      pending: true,
    });

    this.isEdited = true;
    this.rebuildMosaic();
  }

  /**
   * Remove a file from the editor mosaic.
   * Unlike `hide` this function forgets the file completely.
   *
   * @function remove
   * @param {EditorId} id - the file to remove from the editor mosaic
   * @see hide
   * @memberof EditorMosaic
   */
  @action public remove(id: EditorId) {
    console.log(`EditorMosaic: remove ${id}`);
    this.ids.delete(id);
    this.isEdited = true;
    this.rebuildMosaic();
  }

  //=== Getters

  /**
   * Get the current values in the editor mosaic, including hidden files.
   *
   * @function values
   * @public
   * @memberof EditorMosaic
   */
  public values(): EditorValues {
    const values = {};
    for (const [id, data] of this.ids) values[id] = this.value(data);
    return values;
  }

  /**
   * Get the contents of the specified file.
   *
   * @function value
   * @private
   * @param {EditorData} the data to query
   * @see values
   * @memberof EditorMosaic
   */
  private value(data: EditorData) {
    const { backup, editor } = data;

    let value;
    if (editor) {
      value = editor.getValue();
    } else if (backup) {
      value = backup.value;
    }
    return value || '';
  }

  /**
   * Clear-box testing helper.
   *
   * @function inspect
   * @public
   * @memberof EditorMosaic
   */
  public inspect() {
    if (!process.env.JEST_WORKER_ID)
      throw new Error('inspect() is for clear-box testing.');
    const { ids, leaves } = this;
    return { ids, leaves };
  }

  //=== Layout

  /**
   * Rebuild the mosaic layout based on the current files
   *
   * @function rebuildMosaic
   * @private
   */
  @action private rebuildMosaic() {
    const leaves = [...this.leaves].sort(compareEditors);
    this.mosaic = createBalancedTreeFromLeaves(leaves, 'row');
  }

  /**
   * Resets the editor mosaic to its default layout.
   *
   * @function resetLayout
   * @public
   */
  @action public resetLayout() {
    const { isEdited } = this;
    this.set(this.values());
    this.isEdited = isEdited;
  }

  //=== Visibility

  /**
   * Remove an editor from the editor mosaic, but remember it offscreen
   * so that it can be re-shown with `show`.
   *
   * @function hide
   * @public
   * @param {EditorId} id - the file to remove from the editor mosaic
   * @see show
   * @see remove
   */
  @action public hide(id: EditorId) {
    console.log(`EditorMosaic: hide ${id}`);
    const data = this.ids.get(id);
    if (!data?.editor) return; // no editor for that id

    data.backup = this.createBackup(data.editor);
    data.editor = undefined;
    data.pending = false;
    this.rebuildMosaic();
  }

  /**
   * Add a file to the editor mosaic if it was previously hidden.
   * This is the opposite of `hide`
   *
   * @function show
   * @public
   * @param {EditorId} id - the file to add to the editor mosaic
   * @see hide
   * @see showAll
   * @memberof EditorMosaic
   */
  @action public show(id: EditorId) {
    console.log(`EditorMosaic: show ${id}`);
    const data = this.ids.get(id);
    if (!data || data.pending || data.editor) return;

    data.pending = true;
    this.rebuildMosaic();
  }

  /**
   * Shows or hides the given file, depending on its current state
   *
   * @function toggle
   * @public
   * @param {EditorId} id - the file to add to the editor mosaic
   * @see hide
   * @see show
   * @memberof EditorMosaic
   */
  @action public toggle(id: EditorId) {
    if (this.leaves.includes(id)) {
      this.hide(id);
    } else {
      this.show(id);
    }
  }

  /**
   * Show any hidden files.
   *
   * @function showAll
   * @public
   * @see show
   * @memberof EditorMosaic
   */
  @action public showAll() {
    for (const [id, data] of this.ids) {
      if (data.backup) {
        this.show(id);
      }
    }
  }

  //=== IStandaloneCodeEditor helpers

  public focusedEditor(): IStandaloneCodeEditor | undefined {
    return [...this.editors].find((editor) => editor.hasTextFocus());
  }

  private layoutDebounce: any;

  public layout() {
    const DEBOUNCE_MSEC = 50;
    clearTimeout(this.layoutDebounce);
    this.layoutDebounce = setTimeout(() => {
      for (const editor of this.editors) editor.layout();
      this.layoutDebounce = null;
    }, DEBOUNCE_MSEC);
  }

  public updateOptions(options: MonacoType.editor.IEditorOptions) {
    for (const editor of this.editors) editor.updateOptions(options);
  }

  //=== Backup & Restore

  private createBackup(editor: IStandaloneCodeEditor): Backup {
    const model = editor.getModel() || undefined;
    const value = editor.getValue() || '';
    const viewState = editor.saveViewState() || undefined;
    return { model, value, viewState };
  }

  @action public restore(id: EditorId, editor: IStandaloneCodeEditor): boolean {
    const data = this.ids.get(id);
    if (!data?.backup) return false;

    const { backup } = data;
    data.backup = undefined;

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

  //=== Working with mounted Monaco editors

  private createModel(filename: string, value: string) {
    const { monaco } = this.app;
    if (!monaco) throw new Error('monaco not loaded yet');

    const model = monaco.editor.createModel(value, monacoLanguage(filename));
    model.updateOptions({ tabSize: 2 });
    return model;
  }

  @action public addEditor(id: EditorId, editor: IStandaloneCodeEditor) {
    const data = this.ids.get(id);
    if (!data?.pending) {
      throw new Error(`Unexpected editor for file "${id}"`);
    }

    console.log(`EditorMosaic: adding editor for ${id}`);
    data.editor = editor;
    data.pending = false;
    this.observeEdits(editor);
  }

  //=== Listen for user edits

  private ignoreAllEdits() {
    for (const editor of this.editors) this.ignoreEdits(editor);
  }

  private ignoreEdits(editor: IStandaloneCodeEditor) {
    editor.onDidChangeModelContent(() => {
      /* no-op */
    });
  }

  private observeAllEdits() {
    for (const editor of this.editors) this.observeEdits(editor);
  }

  private observeEdits(editor: IStandaloneCodeEditor) {
    const disposable = editor.onDidChangeModelContent(() => {
      this.isEdited ||= true;
      disposable.dispose();
    });
  }

  //=== Misc Helpers: editor generator func

  private *editorGen() {
    for (const { editor } of this.ids.values()) {
      if (editor) {
        yield editor;
      }
    }
  }
  private get editors() {
    return this.editorGen();
  }
}
