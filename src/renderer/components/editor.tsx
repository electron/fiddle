// Credit goes in large part to https://github.com/superRaytin/react-monaco-editor,
// this component is a changed version of it.

import * as MonacoType from 'monaco-editor';
import * as React from 'react';

import { AppState } from '../state';
import { EditorId } from '../../interfaces';
import { EditorMosaic } from '../editor-mosaic';
import { monacoLanguage } from '../../utils/editor-utils';

interface EditorProps {
  appState: AppState;
  editorMosaic: EditorMosaic;
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
    this.language = monacoLanguage(props.id);
  }

  public shouldComponentUpdate() {
    return false;
  }

  public async componentDidMount() {
    return this.initMonaco();
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
    const { editorMosaic, editorDidMount, id } = this.props;

    // Set the editor as an available object.
    editorMosaic.addEditor(id, editor);

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
      console.log('this.editor', JSON.stringify(this.editor));
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
}
