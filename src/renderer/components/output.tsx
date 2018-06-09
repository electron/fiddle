import * as React from 'react';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { OutputEntry } from '../../interfaces';

export interface CommandsProps {
  appState: AppState;
}

/**
 * This component represents the "console" that is shown
 * whenever a fiddle is launched in Electron.
 *
 * @class Output
 * @extends {React.Component<CommandsProps, {}>}
 */
@observer
export class Output extends React.Component<CommandsProps, {}> {
  constructor(props: CommandsProps) {
    super(props);
  }

  /**
   * An individial entry might span multiple lines. To ensure that
   * each line has a timestamp, this method might split up entries.
   *
   * @param {OutputEntry} entry
   * @returns {Array<JSX.Element>}
   * @memberof Output
   */
  public renderEntry(entry: OutputEntry): Array<JSX.Element> {
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
