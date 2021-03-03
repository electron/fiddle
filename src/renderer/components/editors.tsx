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

import { EditorId, MosaicId, PanelId } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { updateEditorLayout } from '../../utils/editor-layout';
import { getFocusedEditor } from '../../utils/focused-editor';
import { getAtPath, setAtPath } from '../../utils/js-path';
import { toggleMonaco } from '../../utils/toggle-monaco';
import { isEditorId } from '../../utils/type-checks';
import { getContent } from '../content';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';
import { activateTheme } from '../themes';
import { Editor } from './editor';
import { renderNonIdealState } from './editors-non-ideal-state';
import {
  DocsDemoGoHomeButton,
  MaximizeButton,
  RemoveButton,
} from './editors-toolbar-button';
import { ShowMe } from './show-me';

const defaultMonacoOptions: MonacoType.editor.IEditorOptions = {
  minimap: {
    enabled: false,
  },
  wordWrap: 'on',
};

export const TITLE_MAP: Record<MosaicId, string> = {
  main: 'Main Process (main.js)',
  renderer: 'Renderer Process (renderer.js)',
  preload: 'Preload (preload.js)',
  html: 'HTML (index.html)',
  css: 'Stylesheet (styles.css)',
  docsDemo: 'Docs & Demos',
};

export interface EditorsProps {
  appState: AppState;
}

export interface EditorsState {
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
    this.renderGenericPanel = this.renderGenericPanel.bind(this);
    this.setFocused = this.setFocused.bind(this);

    this.state = { monacoOptions: defaultMonacoOptions };
  }

  /**
   * Executed right after the component mounts. We'll setup the IPC listeners here.
   *
   * @memberof Editors
   */
  public async componentDidMount() {
    ipcRendererManager.on(
      IpcEvents.MONACO_EXECUTE_COMMAND,
      (_event, cmd: string) => {
        this.executeCommand(cmd);
      },
    );

    ipcRendererManager.on(IpcEvents.FS_NEW_FIDDLE, async (_event) => {
      const { version } = this.props.appState;

      await window.ElectronFiddle.app.replaceFiddle(
        {
          main: await getContent(EditorId.main, version),
          renderer: await getContent(EditorId.renderer, version),
          preload: await getContent(EditorId.preload, version),
          html: await getContent(EditorId.html, version),
        },
        {},
      );
    });

    ipcRendererManager.on(
      IpcEvents.MONACO_TOGGLE_OPTION,
      (_event, cmd: string) => {
        this.toggleEditorOption(cmd);
      },
    );

    ipcRendererManager.on(IpcEvents.SELECT_ALL_IN_EDITOR, (_event) => {
      // programmatically fetch all editor contents and set as selection
      const editor = getFocusedEditor();
      const range = editor?.getModel()?.getFullModelRange();

      if (!!range) {
        editor?.setSelection(range);
      }
    });

    this.setState({ isMounted: true });
    await this.loadMonaco();
    this.props.appState.isUnsaved = false;
  }

  public componentWillUnmount() {
    this.disposeLayoutAutorun();

    ipcRendererManager.removeAllListeners(IpcEvents.MONACO_EXECUTE_COMMAND);
    ipcRendererManager.removeAllListeners(IpcEvents.FS_NEW_FIDDLE);
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
    if (!window.ElectronFiddle.editors) {
      return false;
    }

    try {
      const { monacoOptions } = this.state;
      const newOptions = { ...monacoOptions };
      const currentSetting = getAtPath(path, newOptions);

      setAtPath(path, newOptions, toggleMonaco(currentSetting));

      Object.keys(window.ElectronFiddle.editors).forEach((key) => {
        const editor: MonacoType.editor.IStandaloneCodeEditor | null =
          window.ElectronFiddle.editors[key];

        if (editor) {
          editor.updateOptions(newOptions);
        }
      });

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
   * @param {MosaicWindowProps<MosaicId>} { title }
   * @param {MosaicId} id
   * @returns {JSX.Element}
   */
  public renderToolbar(
    { title }: MosaicWindowProps<MosaicId>,
    id: MosaicId,
  ): JSX.Element {
    const { appState } = this.props;
    const docsDemoGoHomeMaybe =
      id === PanelId.docsDemo ? (
        <DocsDemoGoHomeButton id={id} appState={appState} />
      ) : null;

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
        <div className="mosaic-controls">
          {docsDemoGoHomeMaybe}
          {toolbarControlsMaybe}
        </div>
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
  public renderTile(id: MosaicId, path: Array<MosaicBranch>): JSX.Element {
    const { appState } = this.props;
    const content = isEditorId(id)
      ? this.renderEditor(id)
      : this.renderGenericPanel(id, appState);

    return (
      <MosaicWindow<EditorId>
        className={id}
        path={path}
        title={TITLE_MAP[id]}
        renderToolbar={(props: MosaicWindowProps<MosaicId>) =>
          this.renderToolbar(props, id)
        }
      >
        {content}
      </MosaicWindow>
    );
  }

  /**
   * Renders a generic panel – so not an editor, but something else
   *
   * @param {PanelId} _id
   * @param {AppState} _appState
   * @returns {JSX.Element}
   */
  public renderGenericPanel(_id: PanelId, appState: AppState): JSX.Element {
    return <ShowMe appState={appState} />;
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
      <Mosaic<EditorId | PanelId>
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
