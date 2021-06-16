import { shell } from 'electron';
import { autorun } from 'mobx';
import { observer } from 'mobx-react';
import * as React from 'react';
import {
  MosaicContext,
  MosaicNode,
  MosaicParent,
} from 'react-mosaic-component';
import { isWebUri } from 'valid-url';

import { OutputEntry } from '../../interfaces';
import { AppState } from '../state';
import { WrapperEditorId } from './output-editors-wrapper';

interface CommandsProps {
  appState: AppState;
  // Used to keep testing conform
  renderTimestamp?: (ts: number) => string;
}

/**
 * This component represents the "console" that is shown
 * whenever a Fiddle is launched in Electron.
 *
 * @class Output
 * @extends {React.Component<CommandsProps>}
 */
@observer
export class Output extends React.Component<CommandsProps> {
  public static contextType = MosaicContext;
  public context: MosaicContext<WrapperEditorId>;
  private outputRef = React.createRef<HTMLDivElement>();

  constructor(props: CommandsProps) {
    super(props);

    this.renderTimestamp = this.renderTimestamp.bind(this);
    this.renderEntry = this.renderEntry.bind(this);
  }

  public componentDidMount() {
    autorun(() => {
      /**
       * Type guard to check whether a react-mosaic node is a parent in the tree
       * or a leaf. Leaf nodes are represented by the string value of their ID,
       * whereas parent nodes are objects containing information about the nested
       * binary tree.
       * @param node A react-mosaic node
       * @returns Whether that node is a MosaicParent or not
       */
      const isParentNode = (
        node: MosaicNode<WrapperEditorId> | null,
      ): node is MosaicParent<WrapperEditorId> => {
        return (node as MosaicParent<WrapperEditorId>)?.direction !== undefined;
      };

      const { isConsoleShowing } = this.props.appState;

      // this context should always exist, but mocking context in enzyme
      // is not fully supported, so this condition makes the tests pass
      if (this.context.mosaicActions) {
        const mosaicTree = this.context.mosaicActions.getRoot();
        if (isParentNode(mosaicTree)) {
          // splitPercentage defines the percentage of space the first panel takes
          // e.g. 25 would mean the two children panels are split 25%/75%
          mosaicTree.splitPercentage = isConsoleShowing ? 25 : 0;
          this.context.mosaicActions.replaceWith([], mosaicTree);
        }
      }
    });
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
    const timestamp = <span className="timestamp">{ts}</span>;
    const lines = entry.text.split(/\r?\n/);
    const style: React.CSSProperties = entry.isNotPre
      ? { whiteSpace: 'initial' }
      : {};

    const renderLine = (text: string, lineIndex: number): JSX.Element =>
      isWebUri(text) ? (
        <div key={`${entry.timestamp}--${index}--${lineIndex}`}>
          <span style={style} className="output-message">
            {timestamp}
            <a onClick={() => shell.openExternal(text)}>{text}</a>
          </span>
        </div>
      ) : (
        <div key={`${entry.timestamp}--${index}--${lineIndex}`}>
          <span style={style} className="output-message">
            {timestamp}
            {text}
          </span>
        </div>
      );

    return lines.map(renderLine);
  }

  public render(): JSX.Element | null {
    const { output, isConsoleShowing } = this.props.appState;

    if (!isConsoleShowing) {
      return null;
    }

    // The last 1000 lines
    const lines = output.slice(-1000).map(this.renderEntry);

    return (
      <div className="output" ref={this.outputRef}>
        {lines}
      </div>
    );
  }
}
