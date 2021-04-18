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
import { getEditorTitle } from '../../utils/editor-utils';
import { getAtPath, setAtPath } from '../../utils/js-path';
import { toggleMonaco } from '../../utils/toggle-monaco';
import { getTemplate, getTestTemplate } from '../content';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';
import { Fiddle } from '../fiddle';
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
  fiddle: Fiddle;
}

interface EditorsState {
  monaco?: typeof MonacoType;
  isMounted?: boolean;
  monacoOptions: MonacoType.editor.IEditorOptions;
  focused?: EditorId;
}

@observer
export class Editors extends React.Component<EditorsProps, EditorsState> {
  constructor(props: EditorsProps) {
    super(props);

    for (const name of [
      'onChange',
      'renderEditor',
      'renderTile',
      'renderToolbar',
      'setFocused',
    ]) {
      this[name] = this[name].bind(this);
    }

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
      const { fiddle } = this.props;

      const focused = fiddle.focusedEditor();
      if (focused) {
        const model = focused.getModel();
        if (model) {
          focused.setSelection(model.getFullModelRange());
        }
      }
    });

    this.setState({ isMounted: true });
    await this.loadMonaco();
  }

  public componentWillUnmount() {
    this.stopListening();
  }

  private stopListening() {
    for (const event of [
      IpcEvents.FS_NEW_FIDDLE,
      IpcEvents.FS_NEW_TEST,
      IpcEvents.MONACO_EXECUTE_COMMAND,
      IpcEvents.MONACO_TOGGLE_OPTION,
      IpcEvents.SELECT_ALL_IN_EDITOR,
    ]) {
      ipcRendererManager.removeAllListeners(event);
    }
  }

  /**
   * Attempt to execute a given commandId on the currently focused editor
   *
   * @param {string} commandId
   * @memberof Editors
   */
  public executeCommand(commandId: string) {
    const { fiddle } = this.props;
    const focused = fiddle.focusedEditor();

    if (focused) {
      const command = focused.getAction(commandId);

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
      const { fiddle } = this.props;
      const { monacoOptions } = this.state;

      const options = { ...monacoOptions };
      const currentSetting = getAtPath(path, options);

      setAtPath(path, options, toggleMonaco(currentSetting));
      fiddle.updateOptions(options);
      this.setState({ monacoOptions: options });

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
    const { fiddle } = this.props;

    // only show toolbar controls if we have more than 1 visible editor
    console.log(
      '---> renderToolbar',
      JSON.stringify(fiddle.visible),
      new Error('trace'),
    );
    // FIXME(ckerr) this doesn't ret re-run when fiddle.visible changes...
    const toolbarControlsMaybe = fiddle.visible.length > 1 && (
      <>
        <MaximizeButton fiddle={fiddle} id={id} />
        <RemoveButton fiddle={fiddle} id={id} />
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
    const title = getEditorTitle(id);
    console.log('--> RENDER TILE');

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
    const { appState, fiddle } = this.props;
    const { monaco } = this.state;

    return (
      <Editor
        appState={appState}
        fiddle={fiddle}
        id={id}
        monaco={monaco!}
        monacoOptions={defaultMonacoOptions}
        setFocused={this.setFocused}
      />
    );
  }

  public render() {
    const { fiddle } = this.props;
    const { focused, monaco } = this.state;
    const { visible } = fiddle;

    console.log('--> VISIBLE.LENGTH', visible.length);

    if (!monaco) return null;

    return (
      <Mosaic<EditorId>
        className={`focused__${focused}`}
        onChange={this.onChange}
        value={fiddle.mosaic}
        zeroStateView={renderNonIdealState(fiddle)}
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
    console.log('FIXME(ckerr) this gets called on drag... wat do?');
    this.props.fiddle.mosaic = currentNode;
  }

  /**
   * Loads monaco. If it's already loaded, it'll just set it on the current state.
   * We're doing things a bit roundabout to ensure that we're not overloading the
   * mobx state with a gigantic Monaco tree.
   */
  public async loadMonaco() {
    const { app } = window.ElectronFiddle;

    if (!app.monaco) {
      const loader = require('monaco-loader');
      app.monaco = await loader();
    }

    const { monaco } = app;

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
