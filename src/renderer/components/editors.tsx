import * as React from 'react';

import { toJS } from 'mobx';
import { observer } from 'mobx-react';
import type * as MonacoType from 'monaco-editor';
import {
  Mosaic,
  MosaicBranch,
  MosaicNode,
  MosaicWindow,
  MosaicWindowProps,
} from 'react-mosaic-component';

import { Editor } from './editor';
import { RenderNonIdealState } from './editors-non-ideal-state';
import { MaximizeButton, RemoveButton } from './editors-toolbar-button';
import { EditorId, SetFiddleOptions } from '../../interfaces';
import { AppState } from '../state';
import { getEditorTitle } from '../utils/editor-utils';
import { getAtPath, setAtPath } from '../utils/js-path';
import { toggleMonaco } from '../utils/toggle-monaco';

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
  readonly monaco: typeof MonacoType;
  focused?: EditorId;
  monacoOptions: MonacoType.editor.IEditorOptions;
}

export const Editors = observer(
  class Editors extends React.Component<EditorsProps, EditorsState> {
    constructor(props: EditorsProps) {
      super(props);

      this.onChange = this.onChange.bind(this);
      this.setFocused = this.setFocused.bind(this);

      this.state = {
        monaco: window.monaco,
        monacoOptions: defaultMonacoOptions,
      };
    }

    /**
     * Executed right after the component mounts. We'll setup the IPC listeners here.
     */
    public async componentDidMount() {
      this.stopListening();

      window.ElectronFiddle.addEventListener(
        'execute-monaco-command',
        (cmd: string, opts?: Partial<{ all: boolean }>) => {
          this.executeCommand(cmd, opts);
        },
      );

      window.ElectronFiddle.addEventListener('new-fiddle', async () => {
        const { modules, version } = this.props.appState;
        const values = await window.ElectronFiddle.getTemplate(version);
        const options: SetFiddleOptions = { templateName: version };

        // Clear previously installed modules.
        modules.clear();

        await window.app.replaceFiddle(values, options);
      });

      window.ElectronFiddle.addEventListener('new-test', async () => {
        const values = await window.ElectronFiddle.getTestTemplate();
        const options: SetFiddleOptions = { templateName: 'Test' };

        await window.app.replaceFiddle(values, options);
      });

      window.ElectronFiddle.addEventListener(
        'toggle-monaco-option',
        (cmd: string) => {
          this.toggleEditorOption(cmd);
        },
      );

      window.ElectronFiddle.addEventListener('redo-in-editor', () => {
        const editor = this.props.appState.editorMosaic.getFocusedEditor();
        if (editor) {
          const model = editor.getModel();
          if (model) (model as any).redo();
        }
      });

      window.ElectronFiddle.addEventListener('undo-in-editor', () => {
        const editor = this.props.appState.editorMosaic.getFocusedEditor();
        if (editor) {
          const model = editor.getModel();
          if (model) (model as any).undo();
        }
      });

      window.ElectronFiddle.addEventListener('select-all-in-editor', () => {
        const editor = this.props.appState.editorMosaic.getFocusedEditor();
        if (editor) {
          const model = editor.getModel();
          if (model) {
            editor.setSelection(model.getFullModelRange());
          }
        }
      });
    }

    public componentWillUnmount() {
      this.stopListening();
    }

    private stopListening() {
      window.ElectronFiddle.removeAllListeners('execute-monaco-command');
      window.ElectronFiddle.removeAllListeners('new-fiddle');
      window.ElectronFiddle.removeAllListeners('new-test');
      window.ElectronFiddle.removeAllListeners('toggle-monaco-option');
      window.ElectronFiddle.removeAllListeners('select-all-in-editor');
      window.ElectronFiddle.removeAllListeners('undo-in-editor');
      window.ElectronFiddle.removeAllListeners('redo-in-editor');
    }

    /**
     * Attempt to execute a given commandId on one or more Monaco editors
     */
    public executeCommand(commandId: string, opts?: Partial<{ all: boolean }>) {
      const editors = [];

      if (opts?.all) {
        editors.push(...this.props.appState.editorMosaic.getAllEditors());
      } else {
        const focusedEditor =
          this.props.appState.editorMosaic.getFocusedEditor();
        if (focusedEditor) {
          editors.push(focusedEditor);
        } else {
          return;
        }
      }

      for (const editor of editors) {
        const command = editor.getAction(commandId);

        if (!command) return;

        console.log(
          `Editors: Trying to run ${
            command.id
          }. Supported: ${command.isSupported()}`,
        );

        if (command.isSupported()) {
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
        this.props.appState.editorMosaic.updateOptions(newOptions);
        this.setState({ monacoOptions: newOptions });

        return true;
      } catch (error) {
        console.warn(`Editors: Could not toggle property ${path}`, error);

        return false;
      }
    }

    public render() {
      const { editorMosaic } = this.props.appState;
      // HACK: we use this to force re-renders of the toolbar when severity changes
      const severityLevel = toJS(editorMosaic.editorSeverityMap);
      /**
       * Renders the little toolbar on top of each panel
       */
      const renderToolbar = (
        { title }: MosaicWindowProps<EditorId>,
        id: EditorId,
      ) => {
        const { appState } = this.props;
        return (
          <div role="toolbar">
            {/* Left */}
            <div>
              <h5
                className={`mosaic-toolbar-severity-level-${severityLevel.get(id)}`}
              >
                {title}
              </h5>
            </div>
            {/* Middle */}
            <div />
            {/* Right */}
            <div className="mosaic-controls">
              <MaximizeButton id={id} appState={appState} />
              <RemoveButton id={id} appState={appState} />
            </div>
          </div>
        );
      };

      /**
       * Renders a Mosaic tile
       */
      const renderTile = (id: EditorId, path: Array<MosaicBranch>) => {
        const content = renderEditor(id);
        const title = getEditorTitle(id as EditorId);

        return (
          <MosaicWindow<EditorId>
            className={id}
            path={path}
            title={title}
            renderToolbar={(props: MosaicWindowProps<EditorId>) =>
              renderToolbar(props, id)
            }
          >
            {content}
          </MosaicWindow>
        );
      };

      const renderEditor = (id: EditorId) => {
        const { appState } = this.props;
        const { monaco } = this.state;

        return (
          <Editor
            id={id}
            monaco={monaco}
            appState={appState}
            monacoOptions={defaultMonacoOptions}
            setFocused={this.setFocused}
          />
        );
      };

      return (
        <Mosaic<EditorId>
          className={`focused__${this.state.focused}`}
          onChange={this.onChange}
          value={editorMosaic.mosaic}
          zeroStateView={<RenderNonIdealState editorMosaic={editorMosaic} />}
          renderTile={renderTile}
        />
      );
    }

    /**
     * Handles a change in the visible nodes
     */
    public onChange(currentNode: MosaicNode<EditorId> | null) {
      this.props.appState.editorMosaic.mosaic = currentNode;
    }

    /**
     * Sets the currently-focused editor. This will impact the editor's
     * z-index, ensuring that its intellisense menus don't get clipped
     * by the other editor windows.
     */
    public setFocused(id: EditorId): void {
      this.props.appState.editorMosaic.setFocusedFile(id);
      this.setState({ focused: id });
    }
  },
);
