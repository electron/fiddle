import * as React from 'react';
import { observer } from 'mobx-react';

import { AppState } from '../app';
import { OutputEntry } from '../../interfaces';

export interface CommandsProps {
  appState: AppState;
}

@observer
export class Output extends React.Component<CommandsProps, {}> {
  constructor(props: CommandsProps) {
    super(props);
  }

  public renderEntry(entry: OutputEntry) {
    const ts = new Date(entry.timestamp).toLocaleTimeString();
    const timestamp = <span className='timestamp'>{ts}</span>;
    const lines = entry.text.split(/\r?\n/);

    return lines.map((text) => (
      <p key={ts}>{timestamp}{text}</p>
    ));
  }

  public render() {
    const { isConsoleShowing } = this.props.appState;
    const className = isConsoleShowing ? 'output showing' : 'output';

    const lines = this.props.appState.output.map(this.renderEntry);

    return (
      <div className={className}>
        {lines}
      </div>
    );
  }
}
