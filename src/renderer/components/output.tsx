import { shell } from 'electron';
import { autorun } from 'mobx';
import { observer } from 'mobx-react';
import * as MonacoType from 'monaco-editor';
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
  monaco: typeof MonacoType;
  monacoOptions: MonacoType.editor.IEditorOptions;
  options?: Partial<MonacoType.editor.IEditorConstructionOptions>;
  editorDidMount?: (editor: MonacoType.editor.IStandaloneCodeEditor) => void;
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
  public editor: MonacoType.editor.IStandaloneCodeEditor;
  public language = 'consoleOutputLanguage';
  public value = '';

  private outputRef = React.createRef<HTMLDivElement>();

  constructor(props: CommandsProps) {
    super(props);

    this.renderTimestamp = this.renderTimestamp.bind(this);
    this.renderEntry = this.renderEntry.bind(this);
    this.language = 'consoleOutputLanguage';
  }

  public async componentDidMount() {
    autorun(async () => {
      await this.initMonaco().catch(console.error);

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

  public componentWillUnmount() {
    this.destroyMonaco();
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

  public async editorDidMount(editor: MonacoType.editor.IStandaloneCodeEditor) {
    const { editorDidMount } = this.props;
    await this.setContent(this.props.appState.output);

    if (editorDidMount) {
      editorDidMount(editor);
    }
  }

  // render output into monaco
  UNSAFE_componentWillReceiveProps(newProps: CommandsProps) {
    this.setContent(newProps.appState.output);
  }

  /**
   * Initialize Monaco.
   */
  public async initMonaco() {
    const { monaco, monacoOptions: monacoOptions } = this.props;
    const ref = this.outputRef.current;
    if (ref) {
      this.setupMonacoLanguage(monaco);
      this.editor = monaco.editor.create(ref, {
        language: this.language,
        // TODO: work on allowing this editor to have a different theme than the tiles
        // https://github.com/Microsoft/monaco-editor/issues/338
        theme: 'main',
        contextmenu: false,
        model: null,
        ...monacoOptions,
      });
      await this.editorDidMount(this.editor);
    }
  }

  private setupMonacoLanguage(monaco: any) {
    // register a new language
    monaco.languages.register({ id: 'consoleOutputLanguage' });
    // Register a tokens provider for the language
    monaco.languages.setMonarchTokensProvider('consoleOutputLanguage', {
      tokenizer: {
        root: [[/\d{1,2}:\d{2}:\d{2}\s(A|P)M/, 'custom-date']],
      },
    });
  }

  private async setContent(output: OutputEntry[]) {
    const { appState } = this.props;
    debugger;
    const outputs = output.slice(Math.max(appState.output.length - 1000, 1));
    const lines: string[] = [];
    for (const output of outputs) {
      const date = new Date(output.timestamp).toLocaleTimeString();
      lines.push(date + ' ' + output.text);
    }
    this.createModel(lines.join('\n'));
  }

  /**
   * Create a model and attach it to the editor
   *
   * @private
   * @param {string} value
   */
  private createModel(value: string) {
    const { monaco } = this.props;
    const model = monaco.editor.createModel(value, this.language);
    model.updateOptions({
      tabSize: 2,
    });

    this.editor.setModel(model);
  }

  /**
   * Destroy Monaco.
   */
  public destroyMonaco() {
    if (typeof this.editor !== 'undefined') {
      console.log('Editor: Disposing');
      this.editor.dispose();
    }
  }

  public render(): JSX.Element | null {
    const { isConsoleShowing } = this.props.appState;

    return (
      <div
        className="output"
        ref={this.outputRef}
        style={{ display: isConsoleShowing ? 'block' : 'none' }}
      />
    );
  }
}
