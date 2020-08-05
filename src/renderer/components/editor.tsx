// Credit goes in large part to https://github.com/superRaytin/react-monaco-editor,
// this component is a changed version of it.

import * as MonacoType from 'monaco-editor';
import * as React from 'react';

import { EditorId } from '../../interfaces';
import { getContent } from '../content';
import { AppState } from '../state';

export interface EditorProps {
  appState: AppState;
  monaco: typeof MonacoType;
  monacoOptions: MonacoType.editor.IEditorOptions;
  id: EditorId;
  options?: Partial<MonacoType.editor.IEditorConstructionOptions>;
  editorDidMount?: (editor: MonacoType.editor.IStandaloneCodeEditor) => void;
  onChange?: (
    value: string,
    event: MonacoType.editor.IModelContentChangedEvent,
  ) => void;
  setFocused: (id: EditorId) => void;
}

export class Editor extends React.Component<EditorProps> {
  public editor: MonacoType.editor.IStandaloneCodeEditor;
  public language = 'javascript';
  public value = '';

  private containerRef = React.createRef<HTMLDivElement>();

  constructor(props: EditorProps) {
    super(props);

    switch (props.id) {
      case 'html':
        this.language = 'html';
        break;
      case 'css':
        this.language = 'css';
        break;
      default:
        this.language = 'javascript';
    }
  }

  public shouldComponentUpdate() {
    return false;
  }

  public async componentDidMount() {
    await this.initMonaco();
  }

  public componentWillUnmount() {
    this.destroyMonaco();
  }

  /**
   * Handle the editor having been mounted. This refers to Monaco's
   * mount, not React's.
   *
   * @param {MonacoType.editor.IStandaloneCodeEditor} editor
   */
  public async editorDidMount(editor: MonacoType.editor.IStandaloneCodeEditor) {
    const { editorDidMount } = this.props;

    // Set the content on the editor
    await this.setContent();

    // Set the editor as an available object
    window.ElectronFiddle.editors[this.props.id] = editor;

    // And notify others
    if (editorDidMount) {
      editorDidMount(editor);
    }
  }

  /**
   * Initialize Monaco.
   */
  public async initMonaco() {
    const { monaco, monacoOptions: monacoOptions } = this.props;
    const ref = this.containerRef.current;

    if (ref) {
      this.editor = monaco.editor.create(ref, {
        language: this.language,
        theme: 'main',
        contextmenu: false,
        model: null,
        ...monacoOptions,
      });

      // mark this editor as focused whenever it is
      this.editor.onDidFocusEditorText(() => {
        const { id, setFocused } = this.props;
        setFocused(id);
      });

      await this.editorDidMount(this.editor);
    }
  }

  /**
   * Destroy Monaco.
   */
  public destroyMonaco() {
    if (typeof this.editor !== 'undefined') {
      console.log('Editor: Disposing');
      this.editor.dispose();
    }
  }

  public render() {
    return <div className="editorContainer" ref={this.containerRef} />;
  }

  /**
   * Create a model and attach it to the editor
   *
   * @private
   * @param {string} value
   */
  private createModel(value: string) {
    const { monaco } = this.props;

    const model = monaco.editor.createModel(value, this.language);
    model.updateOptions({
      tabSize: 2,
    });

    this.editor.setModel(model);
  }

  /**
   * Sets the content on the editor, including the model and the view state.
   *
   * @private
   * @memberof Editor
   */
  private async setContent() {
    const { appState, id } = this.props;
    const { version } = appState;

    const backup = appState.getAndRemoveEditorValueBackup(id);

    if (backup) {
      console.log(`Editor: Backup found, restoring state`);

      if (backup.viewState) {
        this.editor.restoreViewState(backup.viewState);
      }

      // If there's a model, use the model. No model? Use the value
      if (backup.model) {
        this.editor.setModel(backup.model);
      } else {
        this.createModel(backup.value ?? '');
      }
    } else {
      const value = await getContent(id, version);
      this.createModel(value);
    }
  }
}
