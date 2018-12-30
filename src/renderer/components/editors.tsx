import * as MonacoType from 'monaco-editor';
import * as React from 'react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';

import { EditorId } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { updateEditorLayout } from '../../utils/editor-layout';
import { getFocusedEditor } from '../../utils/focused-editor';
import { getAtPath, setAtPath } from '../../utils/js-path';
import { toggleMonaco } from '../../utils/toggle-monaco';
import { ContentNames, getContent } from '../content';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';
import { activateTheme } from '../themes';
import { Editor } from './editor';

const options: any = {
  direction: 'row',
  first: 'main',
  second: {
    direction: 'column',
    first: 'renderer',
    second: 'html',
  },
};

const defaultMonacoOptions: MonacoType.editor.IEditorOptions = {
  minimap: {
    enabled: false
  },
  wordWrap: 'on'
};

const ViewIdMosaic = Mosaic.ofType<EditorId>();
const ViewIdMosaicWindow = MosaicWindow.ofType<EditorId>();

const TITLE_MAP: Record<EditorId, string> = {
  main: 'Main Process',
  renderer: 'Renderer Process',
  html: 'HTML'
};

export interface EditorsProps {
  appState: AppState;
}

export interface EditorsState {
  monaco?: typeof MonacoType;
  isMounted?: boolean;
  monacoOptions: MonacoType.editor.IEditorOptions;
}

export class Editors extends React.Component<EditorsProps, EditorsState> {
  constructor(props: EditorsProps) {
    super(props);
    this.state = { monacoOptions: defaultMonacoOptions };
    this.loadMonaco();
  }

  public componentDidMount() {
    ipcRendererManager.on(IpcEvents.MONACO_EXECUTE_COMMAND, (_event, cmd: string) => {
      this.executeCommand(cmd);
    });

    ipcRendererManager.on(IpcEvents.FS_NEW_FIDDLE, async (_event) => {
      const { version } = this.props.appState;

      this.props.appState.setWarningDialogTexts({
        label: 'Your current fiddle is unsaved. Do you want to discard it?'
      });

      window.ElectronFiddle.app.setValues({
        html: await getContent(ContentNames.HTML, version),
        renderer: await getContent(ContentNames.RENDERER, version),
        main: await getContent(ContentNames.MAIN, version),
      });
    });

    ipcRendererManager.on(IpcEvents.MONACO_TOGGLE_OPTION, (_event, cmd: string) => {
      this.toggleEditorOption(cmd);
    });

    this.setState({ isMounted: true });
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

      console.log(`Editors: Trying to run ${command.id}. Supported: ${command.isSupported}`);

      if (command && command.isSupported()) {
        command.run();
      }
    }
  }

  public toggleEditorOption(path: string) {
    if (!window || !window.ElectronFiddle || !window.ElectronFiddle.editors) {
      return;
    }

    try {
      const { monacoOptions } = this.state;
      const newOptions = { ...monacoOptions };
      const currentSetting = getAtPath(path, newOptions);

      setAtPath(path, newOptions, toggleMonaco(currentSetting));

      Object.keys(window.ElectronFiddle.editors)
      .forEach((key) => {
        const editor: MonacoType.editor.IStandaloneCodeEditor | null
          = window.ElectronFiddle.editors[key];

        if (editor) {
          editor.updateOptions(newOptions);
        }
      });

      this.setState({ monacoOptions: newOptions });
    } catch (error) {
      console.warn(`Editors: Could not toggle property ${path}`, error);
    }
  }

  public render() {
    const { appState } = this.props;
    const { monaco } = this.state;

    if (!monaco) return null;

    return (
      <ViewIdMosaic
        onChange={updateEditorLayout}
        // tslint:disable-next-line:jsx-no-multiline-js
        renderTile={(id, path) => (
          <ViewIdMosaicWindow className={id} path={path} title={TITLE_MAP[id]} toolbarControls={<div />}>
            <Editor id={id} monaco={monaco} appState={appState} monoacoOptions={defaultMonacoOptions} />
          </ViewIdMosaicWindow>
        )}
        initialValue={options}
      />
    );
  }

  /**
   * Loads monaco. If it's already loaded, it'll just set it on the current state.
   * We're doing things a bit roundabout to ensure that we're not overloading the
   * mobx state with a gigantic Monaco tree.
   *
   * @private
   */
  private async loadMonaco(): Promise<void> {
    const { app } = window.ElectronFiddle;
    const loader = require('monaco-loader');
    const monaco = app.monaco || await loader();

    if (!app.monaco) {
      app.monaco = monaco;
    }

    if (!this.state || !this.state.isMounted) {
      this.state = { monaco, monacoOptions: defaultMonacoOptions };
    } else {
      this.setState({ monaco });
    }

    activateTheme(monaco, undefined, this.props.appState.theme);
  }
}
