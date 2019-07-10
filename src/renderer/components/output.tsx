import { observer } from 'mobx-react';
import * as React from 'react';

import { OutputEntry } from '../../interfaces';
import { AppState } from '../state';
import { MosaicContext } from 'react-mosaic-component';
import { WrapperMosaicId } from './output-editors-wrapper';

export interface CommandsProps {
  appState: AppState;
  // Used to keep testing conform
  renderTimestamp?: (ts: number) => string;
}

/**
 * This component represents the "console" that is shown
 * whenever a Fiddle is launched in Electron.
 *
 * @class Output
 * @extends {React.Component<CommandsProps, {}>}
 */
@observer
export class Output extends React.Component<CommandsProps, {}> {
  private outputRef = React.createRef<HTMLDivElement>();
  static contextType = MosaicContext;
  public context: MosaicContext<WrapperMosaicId>;

  constructor(props: CommandsProps) {
    super(props);

    this.renderTimestamp = this.renderTimestamp.bind(this);
    this.renderEntry = this.renderEntry.bind(this);
  }

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
    const style: React.CSSProperties = entry.isNotPre ? { whiteSpace: 'initial' } : {};

    return lines.map((text, lineIndex) => (
      <p style={style} key={`${entry.timestamp}--${index}--${lineIndex}`}>
        {timestamp}{text}
      </p>
    ));
  }

  public render() {
    const { isConsoleShowing, output } = this.props.appState;
    if (!isConsoleShowing) {
      this.context.mosaicActions.expand(['first'], 0);
    } else {
      this.context.mosaicActions.expand(['first'], 25);
    }

    // The last 1000 lines
    const lines = output
      .slice(Math.max(output.length - 1000, 1))
      .map(this.renderEntry);

    return (
      <div className="output" ref={this.outputRef}>
        {lines}
      </div>
    );
  }
}
