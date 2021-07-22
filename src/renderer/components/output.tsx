import { autorun, reaction } from 'mobx';
import { observer } from 'mobx-react';
import * as MonacoType from 'monaco-editor';
import * as React from 'react';
import {
  MosaicContext,
  MosaicNode,
  MosaicParent,
} from 'react-mosaic-component';

import { OutputEntry } from '../../interfaces';
import { AppState } from '../state';
import { WrapperEditorId } from './output-editors-wrapper';

interface CommandsProps {
  readonly appState: AppState;
  readonly monaco: typeof MonacoType;
  monacoOptions: MonacoType.editor.IEditorOptions;
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
  public editor?: MonacoType.editor.IStandaloneCodeEditor;
  public language = 'consoleOutputLanguage';

  private outputRef = React.createRef<HTMLDivElement>();
  private outputTimeStamps: string[] = [];
  private readonly model: MonacoType.editor.ITextModel;

  constructor(props: CommandsProps) {
    super(props);

    const { monaco } = this.props;
    this.language = 'consoleOutputLanguage';
    this.model = monaco.editor.createModel('', this.language);
    this.updateModel();
    reaction(
      () => props.appState.output.length,
      () => this.updateModel(),
    );
  }

  public async componentDidMount() {
    autorun(async () => {
      await this.initMonaco();
      this.toggleConsole();
    });
  }

  public componentWillUnmount() {
    this.destroyMonacoEditor();
  }

  public componentDidUpdate() {
    this.toggleConsole();
  }

  /**
   * Initialize Monaco.
   */
  public async initMonaco() {
    const { monaco, monacoOptions: monacoOptions } = this.props;
    const ref = this.outputRef.current;
    this.getLineNumber = this.getLineNumber.bind(this);
    if (ref) {
      this.setupCustomOutputEditorLanguage(monaco);
      this.editor = monaco.editor.create(ref, {
        language: this.language,
        theme: 'main',
        readOnly: true,
        contextmenu: false,
        automaticLayout: true,
        model: this.model,
        ...monacoOptions,
        lineNumbers: this.getLineNumber,
        lineNumbersMinChars: 12,
        wordWrap: 'on',
      });
    }
  }

  /**
   * Destroy Monaco.
   */
  public destroyMonacoEditor() {
    if (typeof this.editor !== 'undefined') {
      console.log('Editor: Disposing');
      this.editor.dispose();
      delete this.editor;
    }
  }

  public getLineNumber(originalLineNumber: number) {
    return this.outputTimeStamps[originalLineNumber - 1];
  }

  public toggleConsole() {
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

    if (this.context.mosaicActions) {
      const mosaicTree = this.context.mosaicActions.getRoot();
      if (isParentNode(mosaicTree)) {
        // splitPercentage defines the percentage of space the first panel takes
        // e.g. 25 would mean the two children panels are split 25%/75%
        if (!isConsoleShowing) {
          mosaicTree.splitPercentage = 0;
        } else if (mosaicTree.splitPercentage === 0) {
          mosaicTree.splitPercentage = 25;
        }
        this.context.mosaicActions.replaceWith([], mosaicTree);
      }
    }
  }

  /**
   * Set up Monaco Language to catch custom regex expressions
   *
   * tokenizes timestamps so`main` theme can render them with a custom colour.
   */
  private setupCustomOutputEditorLanguage(monaco: typeof MonacoType) {
    // register a new language
    monaco.languages.register({ id: 'consoleOutputLanguage' });
    // Register a tokens provider for the language
    monaco.languages.setMonarchTokensProvider('consoleOutputLanguage', {
      tokenizer: {
        root: [[/\d{1,2}:\d{2}:\d{2}\s(A|P)M/, 'custom-date']],
      },
    });
  }

  /**
   * Sets the model and content on the editor
   *
   * @private
   * @memberof Output
   */
  private async updateModel() {
    this.model.setValue(this.getOutputLines(this.props.appState.output));
    // have terminal always scroll to the bottom
    this.editor?.revealLine(this.editor?.getScrollHeight());
  }

  /**
   * Processes output entries such that each entry has a timestamp and value text.
   *
   * An individual entry might span multiple lines. To ensure that
   * each line has a timestamp, this method might split up entries.
   *
   * @param {OutputEntry} entry
   * @returns string
   * @memberof Output
   */
  private getOutputLines(output: OutputEntry[]) {
    const lines: string[] = [];
    const outputs = output.slice(-1000);

    // reset outputTimeStamps
    this.outputTimeStamps = [];

    for (const output of outputs) {
      const segments = output.text.split(/\r?\n/);

      const date = new Date(output.timestamp).toLocaleTimeString();
      for (const segment of segments) {
        lines.push(segment);
        this.outputTimeStamps.push(date);
      }
    }
    return lines.join('\n');
  }

  public render(): JSX.Element | null {
    const { isConsoleShowing } = this.props.appState;

    return (
      <div
        className="output"
        ref={this.outputRef}
        style={{ display: isConsoleShowing ? 'inline-block' : 'none' }}
      />
    );
  }
}
