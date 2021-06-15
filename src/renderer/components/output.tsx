import { autorun } from 'mobx';
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

    this.language = 'consoleOutputLanguage';
  }

  public async componentDidMount() {
    autorun(async () => {
      this.destroyMonaco();
      await this.initMonaco();
      this.toggleConsole();
    });
  }

  public componentWillUnmount() {
    this.destroyMonaco();
  }

  public componentDidUpdate() {
    this.toggleConsole();
  }

  /**
   * Handle the editor having been mounted. This refers to Monaco's
   * mount, not React's.
   */
  public async editorDidMount() {
    await this.setContent(this.props.appState.output);
  }

  /**
   *  Set Monaco Editor's value.
   */
  public async UNSAFE_componentWillReceiveProps(newProps: CommandsProps) {
    await this.setContent(newProps.appState.output);
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
        theme: 'main',
        readOnly: true,
        contextmenu: false,
        automaticLayout: true,
        model: null,
        ...monacoOptions,
      });

      await this.editorDidMount();
    }
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
   * Set up Monaco Language.
   */
  private setupMonacoLanguage(monaco: typeof MonacoType) {
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
  private async setContent(output: OutputEntry[]) {
    this.createModel(this.getOutputLines(output));
    // have terminal always scroll to the bottom
    this.editor.revealLine(this.editor.getScrollHeight());
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
    const { appState } = this.props;
    const lines: string[] = [];
    const outputs = output.slice(Math.max(appState.output.length - 1000, 1));

    for (const output of outputs) {
      const segments = output.text.split(/\r?\n/);
      const date = new Date(output.timestamp).toLocaleTimeString();
      for (const segment of segments) {
        lines.push(date + ' ' + segment);
      }
    }
    return lines.join('\n');
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
