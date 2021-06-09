import { observer } from 'mobx-react';
import * as MonacoType from 'monaco-editor';
import * as React from 'react';

import { AppState } from '../state';
import { activateTheme } from '../themes';
import { Output } from './output';

const defaultMonacoOptions: MonacoType.editor.IEditorOptions = {
  minimap: {
    enabled: false,
  },
  wordWrap: 'on',
};

interface OutputsProps {
  appState: AppState;
}

interface OutputsState {
  monaco?: typeof MonacoType;
  isMounted?: boolean;
  monacoOptions: MonacoType.editor.IEditorOptions;
}

@observer
export class Outputs extends React.Component<OutputsProps, OutputsState> {
  constructor(props: OutputsProps) {
    super(props);

    this.state = { monacoOptions: defaultMonacoOptions };
  }

  /**
   * Executed right after the component mounts. We'll setup the IPC listeners here.
   *
   * @memberof Outputs
   */
  public async componentDidMount() {
    await this.loadMonaco();
    this.setState({ isMounted: true });
  }

  public render() {
    const { appState } = this.props;
    const { monaco } = this.state;

    if (!monaco) {
      return null;
    }

    return (
      <Output
        monaco={monaco!}
        appState={appState}
        monacoOptions={defaultMonacoOptions}
      />
    );
  }

  /**
   * Loads monaco. If it's already loaded, it'll just set it on the current state.
   * We're doing things a bit roundabout to ensure that we're not overloading the
   * mobx state with a gigantic Monaco tree.
   */
  public async loadMonaco() {
    console.log('LOADING MONACO');
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
}
