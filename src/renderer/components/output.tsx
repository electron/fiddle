import * as React from 'react';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { OutputEntry } from '../../interfaces';

export interface CommandsProps {
  appState: AppState;
  renderTimestamp?: (ts: number) => string;
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
  private outputRef = React.createRef<HTMLDivElement>();

  public componentDidUpdate() {
    if (this.outputRef.current) {
      this.outputRef.current.scrollTop = this.outputRef.current.scrollHeight;
    }
  }

  /**
   * Render the timestamp
   *
   * @param {number} ts
   * @returns {string}
   */
  public renderTimestamp(ts: number): string {
    const { renderTimestamp } = this.props;

    if (renderTimestamp) {
      return renderTimestamp(ts);
    } else {
      return new Date(ts).toLocaleTimeString();
    }
  }

  /**
   * An individual entry might span multiple lines. To ensure that
   * each line has a timestamp, this method might split up entries.
   *
   * @param {OutputEntry} entry
   * @returns {Array<JSX.Element>}
   * @memberof Output
   */
  public renderEntry(entry: OutputEntry, index: number): Array<JSX.Element> {
    const ts = this.renderTimestamp(entry.timestamp);
    const timestamp = <span className='timestamp'>{ts}</span>;
    const lines = entry.text.split(/\r?\n/);

    return lines.map((text, lineIndex) => (
      <p key={`${entry.timestamp}--${index}--${lineIndex}`}>{timestamp}{text}</p>
    ));
  }

  public render() {
    const { isConsoleShowing } = this.props.appState;
    const className = isConsoleShowing ? 'output showing' : 'output';

    const lines = this.props.appState.output.map(this.renderEntry);

    return (
      <div className={className} ref={this.outputRef}>
        {lines}
      </div>
    );
  }
}
