// Credit goes in large part to https://github.com/superRaytin/react-monaco-editor,
// this component is a changed version of it.

import * as React from 'react';

import * as MonacoType from 'monaco-editor';

import { EditorId } from '../../interfaces';
import { monacoLanguage } from '../../utils/editor-utils';
import { AppState } from '../state';

interface EditorProps {
  readonly appState: AppState;
  readonly id: EditorId;
  readonly monaco: typeof MonacoType;
  monacoOptions: MonacoType.editor.IEditorOptions;
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
    const { appState, editorDidMount, id } = this.props;
    const { editorMosaic } = appState;

    editorMosaic.addEditor(id, editor);

    // And notify others
    if (editorDidMount) {
      editorDidMount(editor);
    }

    // Click file tree, if the file is hidden, focus it
    // Because you can't focus immediately after redisplay, you must wait until the mount is complete
    if (editorMosaic.focusedFile === id) {
      editor.focus();
      this.props.setFocused(id);
    }
  }

  /**
   * Initialize Monaco.
   */
  public async initMonaco() {
    const { monaco, monacoOptions: monacoOptions, appState } = this.props;
    const ref = this.containerRef.current;

    const { fontFamily, fontSize } = appState;

    if (ref) {
      this.editor = monaco.editor.create(ref, {
        automaticLayout: true,
        language: this.language,
        theme: 'main',
        fontFamily,
        fontSize,
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
}
