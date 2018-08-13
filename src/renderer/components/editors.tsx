import * as MonacoType from 'monaco-editor';
import * as React from 'react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';

import { EditorId } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { updateEditorLayout } from '../../utils/editor-layout';
import { getFocusedEditor } from '../../utils/focused-editor';
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

    ipcRendererManager.on(IpcEvents.FS_NEW_FIDDLE, async (_event, cmd: string) => {
      window.ElectronFiddle.app.setValues({
        html: await getContent(ContentNames.HTML),
        renderer: await getContent(ContentNames.RENDERER),
        main: await getContent(ContentNames.MAIN)
      });
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
          <ViewIdMosaicWindow className={id} path={path} title={TITLE_MAP[id]} toolbarControls={<div />}>
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

    if (!app.monaco) {
      app.monaco = monaco;
    }

    if (!this.state || !this.state.isMounted) {
      this.state = { monaco };
    } else {
      this.setState({ monaco });
    }

    activateTheme(monaco, undefined, this.props.appState.theme);
  }
}
