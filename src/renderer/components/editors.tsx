import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import * as React from 'react';
import * as MonacoType from 'monaco-editor';

import { mainTheme } from '../themes';
import { AppState } from '../state';
import { Editor } from './editor';
import { EditorId } from '../../interfaces';
import { updateEditorLayout } from '../../utils/editor-layout';
import { ipcRendererManager } from '../ipc';
import { IpcEvents } from '../../ipc-events';
import { getFocusedEditor } from '../../utils/focused-editor';

const options: any = {
  direction: 'row',
  first: 'main',
  second: {
    direction: 'column',
    first: 'renderer',
    second: 'html',
  },
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
}

export class Editors extends React.Component<EditorsProps, EditorsState> {
  constructor(props: EditorsProps) {
    super(props);

    this.state = {};
    this.loadMonaco();
  }

  public componentDidMount() {
    ipcRendererManager.on(IpcEvents.MONACO_EXECUTE_COMMAND, (_event, cmd: string) => {
      this.executeCommand(cmd);
    });
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
      if (command && command.isSupported()) {
        command.run();
      }
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
          <ViewIdMosaicWindow path={path} title={TITLE_MAP[id]} toolbarControls={<div />}>
            <Editor id={id} monaco={monaco} appState={appState} />
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

    monaco.editor.defineTheme('main', mainTheme as any);


    if (!app.monaco) {
      app.monaco = monaco;
    }

    this.setState({ monaco });
    this.createThemes();
  }

  /**
   * We have a custom theme for the Monaco editor. This sets that up.
   */
  private createThemes(): void {
    if (!this.state.monaco) return;
    this.state.monaco.editor.defineTheme('main', mainTheme as any);
  }
}
