// Credit goes in large part to https://github.com/superRaytin/react-monaco-editor,
// this component is a changed version of it.

import * as React from 'react';
import * as MonacoType from 'monaco-editor';
import { AppState } from '../state';
import { getContent } from '../content';

export interface EditorProps {
  appState: AppState;
  monaco: typeof MonacoType;
  id: string;
  options?: Partial<MonacoType.editor.IEditorConstructionOptions>;
  editorDidMount?: (editor: MonacoType.editor.IStandaloneCodeEditor) => void;
  onChange?: (value: string, event: MonacoType.editor.IModelContentChangedEvent) => void;
}

export class Editor extends React.Component<EditorProps> {
  public containerElement: HTMLElement | null = null;
  public editor: MonacoType.editor.IStandaloneCodeEditor;
  public language: string = 'javascript';
  public value: string = '';
  public options: Partial<MonacoType.editor.IEditorConstructionOptions>;

  constructor(props: EditorProps) {
    super(props);

    this.language = props.id === 'html' ? 'html' : 'javascript';
    this.options = {
      language: this.language,
      theme: 'main',
      minimap: {
        enabled: false
      },
      value: getContent(props.id)
    };
  }

  public componentDidMount() {
    this.initMonaco();
  }

  public componentWillUnmount() {
    this.destroyMonaco();
  }

  public editorDidMount(editor: MonacoType.editor.IStandaloneCodeEditor) {
    const { editorDidMount } = this.props;

    if (editorDidMount) {
      editorDidMount(editor);
    }

    window.ElectronFiddle.editors[this.props.id] = editor;
  }

  public initMonaco() {
    const { options, monaco } = this.props;

    if (this.containerElement) {
      this.editor = monaco.editor.create(this.containerElement, {
        ...this.options,
        ... options
      });
      this.editorDidMount(this.editor);
    }
  }

  public destroyMonaco() {
    if (typeof this.editor !== 'undefined') {
      this.editor.dispose();
    }
  }

  public assignRef = (component) => {
    this.containerElement = component;
  }

  public render() {
    return <div className='editorContainer' ref={this.assignRef} />;
  }
}
