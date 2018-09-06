// Credit goes in large part to https://github.com/superRaytin/react-monaco-editor,
// this component is a changed version of it.

import * as MonacoType from 'monaco-editor';
import * as React from 'react';
import { ContentNames, getContent } from '../content';
import { AppState } from '../state';

export interface EditorProps {
  appState: AppState;
  monaco: typeof MonacoType;
  id: string;
  options?: Partial<MonacoType.editor.IEditorConstructionOptions>;
  editorDidMount?: (editor: MonacoType.editor.IStandaloneCodeEditor) => void;
  onChange?: (value: string, event: MonacoType.editor.IModelContentChangedEvent) => void;
}

export class Editor extends React.Component<EditorProps> {
  public editor: MonacoType.editor.IStandaloneCodeEditor;
  public language: string = 'javascript';
  public value: string = '';

  private containerRef = React.createRef<HTMLDivElement>();

  constructor(props: EditorProps) {
    super(props);

    this.language = props.id === 'html' ? 'html' : 'javascript';
  }

  public shouldComponentUpdate() {
    return false;
  }

  public componentDidMount() {
    this.initMonaco();
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
  public editorDidMount(editor: MonacoType.editor.IStandaloneCodeEditor) {
    const { editorDidMount } = this.props;

    window.ElectronFiddle.editors[this.props.id] = editor;

    if (editorDidMount) {
      editorDidMount(editor);
    }
  }

  /**
   * Initialize Monaco.
   */
  public async initMonaco() {
    const { options, monaco, id, appState } = this.props;
    const { version } = appState;
    const ref = this.containerRef.current;

    if (ref) {
      this.editor = monaco.editor.create(ref, {
        language: this.language,
        theme: 'main',
        minimap: {
          enabled: false
        },
        contextmenu: false,
        value: await getContent(id as ContentNames, version),
        wordWrap: "on",
        ...options
      });
      this.editorDidMount(this.editor);
    }
  }

  /**
   * Destroy Monaco.
   */
  public destroyMonaco() {
    if (typeof this.editor !== 'undefined') {
      this.editor.dispose();
    }
  }

  public render() {
    return <div className='editorContainer' ref={this.containerRef} />;
  }
}
