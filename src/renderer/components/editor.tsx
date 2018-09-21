// Credit goes in large part to https://github.com/superRaytin/react-monaco-editor,
// this component is a changed version of it.

import * as MonacoType from 'monaco-editor';
import * as React from 'react';
import { ContentNames, getContent } from '../content';
import { AppState } from '../state';
import { IpcEvents } from '../../ipc-events';
import { ipcRendererManager } from '../ipc';


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
    this.state = {
      'options': {
        'wordWrap': 'off',
      },
      'minimap': {
        'enabled': false
      }
    }
  }

  public shouldComponentUpdate() {
    return false;
  }

  public componentDidMount() {
    ipcRendererManager.on(IpcEvents.TOGGLE_SOFT_WRAP, async (_event) => {
      var oldState = this.state;
      if (this.state['options'].wordWrap == "off") {
        oldState['options'].wordWrap = "on";

        this.setState(oldState);
        this.editor.updateOptions({
          'wordWrap': 'on'
        });
      } else if (this.state['options'].wordWrap == "on") {
        oldState['options'].wordWrap = "off";

        this.setState(oldState);
        this.editor.updateOptions({
          'wordWrap': 'off'
        });
      }
    });

    ipcRendererManager.on(IpcEvents.TOGGLE_MINI_MAP, async (_event) => {
      var oldState = this.state;
      if (!this.state['minimap']['enabled']) {
        oldState['minimap']['enabled'] = true;

        this.setState(oldState);
        this.editor.updateOptions({
          minimap: {
            enabled: true,
          }
        });
      } else if (this.state['minimap']['enabled']) {
        oldState['minimap']['enabled'] = false;

        this.setState(oldState);
        this.editor.updateOptions({
          minimap: {
            enabled: false,
          }
        });
      }
    });
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
    const { monaco, id, appState } = this.props;
    const { options, minimap } = this.state;
    const { version } = appState;
    const ref = this.containerRef.current;

    if (ref) {
      this.editor = monaco.editor.create(ref, {
        language: this.language,
        theme: 'main',
        minimap: minimap,
        contextmenu: false,
        value: await getContent(id as ContentNames, version),
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
