import { reaction } from 'mobx';
import { observer } from 'mobx-react';
import * as MonacoType from 'monaco-editor';
import * as React from 'react';
import {
  Mosaic,
  MosaicBranch,
  MosaicNode,
  MosaicWindow,
  MosaicWindowProps,
} from 'react-mosaic-component';

import { EditorId, SetFiddleOptions } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { updateEditorLayout } from '../../utils/editor-layout';
import { getFocusedEditor } from '../../utils/focused-editor';
import { getAtPath, setAtPath } from '../../utils/js-path';
import { toggleMonaco } from '../../utils/toggle-monaco';
import { getEditorTitle } from '../../utils/editor-utils';
import { getTemplate, getTestTemplate } from '../content';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';
import { activateTheme } from '../themes';
import { Editor } from './editor';
import { renderNonIdealState } from './editors-non-ideal-state';
import { MaximizeButton, RemoveButton } from './editors-toolbar-button';

const defaultMonacoOptions: MonacoType.editor.IEditorOptions = {
  minimap: {
    enabled: false,
  },
  wordWrap: 'on',
};

interface EditorsProps {
  appState: AppState;
}

interface EditorsState {
  monaco?: typeof MonacoType;
  isMounted?: boolean;
  monacoOptions: MonacoType.editor.IEditorOptions;
  focused?: EditorId;
}

@observer
export class Editors extends React.Component<EditorsProps, EditorsState> {
  // A reaction: Each time mosaicArrangement is changed, we'll update
  // the editor layout. That method is itself debounced.
  public disposeLayoutAutorun = reaction(
    () => this.props.appState.mosaicArrangement,
    () => updateEditorLayout(),
  );

  constructor(props: EditorsProps) {
    super(props);

    this.onChange = this.onChange.bind(this);
    this.renderEditor = this.renderEditor.bind(this);
    this.renderTile = this.renderTile.bind(this);
    this.setFocused = this.setFocused.bind(this);

    this.state = { monacoOptions: defaultMonacoOptions };
  }

  /**
   * Executed right after the component mounts. We'll setup the IPC listeners here.
   *
   * @memberof Editors
   */
  public async componentDidMount() {
    this.stopListening();

    ipcRendererManager.on(
      IpcEvents.MONACO_EXECUTE_COMMAND,
      (_event, cmd: string) => {
        this.executeCommand(cmd);
      },
    );

    ipcRendererManager.on(IpcEvents.FS_NEW_FIDDLE, async (_event) => {
      const { version } = this.props.appState;
      const values = await getTemplate(version);
      const options: SetFiddleOptions = { templateName: version };

      await window.ElectronFiddle.app.replaceFiddle(values, options);
    });

    ipcRendererManager.on(IpcEvents.FS_NEW_TEST, async (_event) => {
      const values = await getTestTemplate();
      const options: SetFiddleOptions = { templateName: 'Test' };

      await window.ElectronFiddle.app.replaceFiddle(values, options);
    });

    ipcRendererManager.on(
      IpcEvents.MONACO_TOGGLE_OPTION,
      (_event, cmd: string) => {
        this.toggleEditorOption(cmd);
      },
    );

    ipcRendererManager.on(IpcEvents.SELECT_ALL_IN_EDITOR, (_event) => {
      const editor = getFocusedEditor();
      if (editor) {
        const model = editor.getModel();
        if (model) {
          editor.setSelection(model.getFullModelRange());
        }
      }
    });

    this.setState({ isMounted: true });
    await this.loadMonaco();
    this.props.appState.isUnsaved = false;
  }

  public componentWillUnmount() {
    this.disposeLayoutAutorun();
    this.stopListening();
  }

  private stopListening() {
    ipcRendererManager.removeAllListeners(IpcEvents.MONACO_EXECUTE_COMMAND);
    ipcRendererManager.removeAllListeners(IpcEvents.FS_NEW_FIDDLE);
    ipcRendererManager.removeAllListeners(IpcEvents.FS_NEW_TEST);
    ipcRendererManager.removeAllListeners(IpcEvents.MONACO_TOGGLE_OPTION);
    ipcRendererManager.removeAllListeners(IpcEvents.SELECT_ALL_IN_EDITOR);
  }

  /**
   * Attempt to execute a given commandId on the currently focused editor
   *
   * @param {string} commandId
   * @memberof Editors
   */
  public executeCommand(commandId: string) {
    const editor = getFocusedEditor();

    if (editor) {
      const command = editor.getAction(commandId);

      console.log(
        `Editors: Trying to run ${command.id}. Supported: ${command.isSupported}`,
      );

      if (command && command.isSupported()) {
        command.run();
      }
    }
  }

  public toggleEditorOption(path: string): boolean {
    try {
      const { monacoOptions } = this.state;
      const newOptions = { ...monacoOptions };
      const currentSetting = getAtPath(path, newOptions);

      setAtPath(path, newOptions, toggleMonaco(currentSetting));

      const { editorMosaic } = window.ElectronFiddle.app.state;
      for (const editor of editorMosaic.editors.values()) {
        editor.updateOptions(newOptions);
      }

      this.setState({ monacoOptions: newOptions });

      return true;
    } catch (error) {
      console.warn(`Editors: Could not toggle property ${path}`, error);

      return false;
    }
  }

  /**
   * Renders the little tool bar on top of each panel
   *
   * @param {MosaicWindowProps<EditorId>} { title }
   * @param {EditorId} id
   * @returns {JSX.Element}
   */
  public renderToolbar(
    { title }: MosaicWindowProps<EditorId>,
    id: EditorId,
  ): JSX.Element {
    const { appState } = this.props;

    // only show toolbar controls if we have more than 1 visible editor
    // Mosaic arrangement is type string if 1 editor, object otherwise
    const toolbarControlsMaybe = typeof appState.mosaicArrangement !==
      'string' && (
      <>
        <MaximizeButton id={id} appState={appState} />
        <RemoveButton id={id} appState={appState} />
      </>
    );

    return (
      <div>
        {/* Left */}
        <div>
          <h5>{title}</h5>
        </div>
        {/* Middle */}
        <div />
        {/* Right */}
        <div className="mosaic-controls">{toolbarControlsMaybe}</div>
      </div>
    );
  }

  /**
   * Renders a Mosaic tile
   *
   * @param {string} id
   * @param {string} path
   * @returns {JSX.Element | null}
   */
  public renderTile(id: EditorId, path: Array<MosaicBranch>): JSX.Element {
    const content = this.renderEditor(id);
    const title = getEditorTitle(id as EditorId);

    return (
      <MosaicWindow<EditorId>
        className={id}
        path={path}
        title={title}
        renderToolbar={(props: MosaicWindowProps<EditorId>) =>
          this.renderToolbar(props, id)
        }
      >
        {content}
      </MosaicWindow>
    );
  }

  /**
   * Render an editor
   *
   * @param {EditorId} id
   * @returns {(JSX.Element | null)}
   * @memberof Editors
   */
  public renderEditor(id: EditorId): JSX.Element | null {
    const { appState } = this.props;
    const { monaco } = this.state;

    return (
      <Editor
        id={id}
        monaco={monaco!}
        appState={appState}
        monacoOptions={defaultMonacoOptions}
        setFocused={this.setFocused}
      />
    );
  }

  public render() {
    const { appState } = this.props;
    const { monaco } = this.state;

    if (!monaco) return null;

    return (
      <Mosaic<EditorId>
        className={`focused__${this.state.focused}`}
        onChange={this.onChange}
        value={appState.mosaicArrangement}
        zeroStateView={renderNonIdealState(appState)}
        renderTile={this.renderTile}
      />
    );
  }

  /**
   * Handles a change in the visible nodes
   *
   * @param {(MosaicNode<EditorId> | null)} currentNode
   */
  public onChange(currentNode: MosaicNode<EditorId> | null) {
    this.props.appState.mosaicArrangement = currentNode;
  }

  /**
   * Loads monaco. If it's already loaded, it'll just set it on the current state.
   * We're doing things a bit roundabout to ensure that we're not overloading the
   * mobx state with a gigantic Monaco tree.
   */
  public async loadMonaco() {
    const { app } = window.ElectronFiddle;
    const loader = require('monaco-loader');
    const monaco = app.monaco || (await loader());

    if (!app.monaco) {
      app.monaco = monaco;
    }

    if (!this.state || !this.state.isMounted) {
      this.setState({
        monaco,
        monacoOptions: defaultMonacoOptions,
      });
    } else {
      this.setState({ monaco });
    }

    await activateTheme(monaco, undefined, this.props.appState.theme);
  }

  /**
   * Sets the currently-focused editor. This will impact the editor's
   * z-index, ensuring that its intellisense menus don't get clipped
   * by the other editor windows.
   * @param id Editor ID
   */
  public setFocused(id: EditorId): void {
    this.setState({ focused: id });
  }
}
