import * as React from 'react';

import { observer } from 'mobx-react';
import * as MonacoType from 'monaco-editor';

import { Output } from './output';
import { AppState } from '../state';

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
  readonly monaco: typeof MonacoType;
  monacoOptions: MonacoType.editor.IEditorOptions;
}

export const Outputs = observer(
  class Outputs extends React.Component<OutputsProps, OutputsState> {
    constructor(props: OutputsProps) {
      super(props);

      this.state = {
        monaco: window.monaco,
        monacoOptions: defaultMonacoOptions,
      };
    }

    public render() {
      const { appState } = this.props;
      const { monaco } = this.state;

      return (
        <Output
          monaco={monaco}
          appState={appState}
          monacoOptions={defaultMonacoOptions}
        />
      );
    }
  },
);
