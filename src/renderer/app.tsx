import { when } from 'mobx';
import * as MonacoType from 'monaco-editor';

import { ALL_EDITORS, EditorId, EditorValues } from '../interfaces';
import { updateEditorLayout } from '../utils/editor-layout';
import { getEditorValue } from '../utils/editor-value';
import { getPackageJson, PackageJsonOptions } from '../utils/get-package';
import { isEditorBackup } from '../utils/type-checks';
import { FileManager } from './file-manager';
import { Runner } from './runner';
import { appState } from './state';
import { getTheme } from './themes';

/**
 * The top-level class controlling the whole app. This is *not* a React component,
 * but it does eventually render all components.
 *
 * @class App
 */
export class App {
  public typeDefDisposable: MonacoType.IDisposable | null = null;
  public monaco: typeof MonacoType | null = null;
  public state = appState;
  public fileManager = new FileManager(appState);
  public runner = new Runner(appState);

  constructor() {
    this.getValues = this.getValues.bind(this);
    this.setValues = this.setValues.bind(this);
  }

  /**
   * Sets the values on all three editors.
   *
   * @param {EditorValues} values
   * @param {warn} warn - Should we warn before overwriting unsaved data?
   */
  public async setValues(values: Partial<EditorValues>, warn: boolean = true): Promise<boolean> {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle) {
      throw new Error('Fiddle not ready');
    }

    if (this.state.isUnsaved && warn) {
      this.state.isWarningDialogShowing = true;
      await when(() => !this.state.isWarningDialogShowing);

      if (!this.state.warningDialogLastResult) {
        return false;
      }
    }

    for (const name of ALL_EDITORS) {
      const editor = fiddle.editors[name];
      const backup = this.state.closedPanels[name];

      if (isEditorBackup(backup) && backup.model && values[name]) {
        // The editor does not exist, attempt to set it on the backup
        backup.model.setValue(values[name]!);
      } else if (editor && editor.setValue && values[name]) {
        // The editor exists, set the value directly
        editor.setValue(values[name]!);
      }
    }

    this.state.isUnsaved = false;
    this.setupUnsavedOnChangeListener();

    return true;
  }

  /**
   * Gets the values on all three editors.
   *
   * @returns {EditorValues}
   */
  public async getValues(options?: PackageJsonOptions): Promise<EditorValues> {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle) {
      throw new Error('Fiddle not ready');
    }

    const values: EditorValues = {
      html: getEditorValue(EditorId.html),
      main: getEditorValue(EditorId.main),
      renderer: getEditorValue(EditorId.renderer),
    };

    if (options && options.include !==  false) {
      values.package = await getPackageJson(this.state, values, options);
    }

    return values;
  }

  /**
   * Initial setup call, loading Monaco and kicking off the React
   * render process.
   */
  public async setup(): Promise<void | Element | React.Component> {
    this.setupTheme();

    const React = await import('react');
    const { render } = await import('react-dom');
    const { Header } = await import('./components/header');
    const { Dialogs } = await import('./components/dialogs');
    const { Editors } = await import('./components/editors');

    const className = `${process.platform} container`;
    const app = (
      <div className={className}>
        <Header appState={this.state} />
        <Dialogs appState={this.state} />
        <Editors appState={this.state} />
      </div>
    );

    const rendered = render(app, document.getElementById('app'));

    this.setupResizeListener();

    // Todo: A timer here is terrible. Let's fix this
    // and ensure we actually do it once Editors have mounted.
    setTimeout(() => {
      this.setupUnsavedOnChangeListener();
    }, 1500);

    return rendered;
  }

  /**
   * If the editor is changed for the first time, we'll
   * set `isUnsaved` to true. That way, the app can warn you
   * if you're about to throw things away.
   */
  public setupUnsavedOnChangeListener() {
    Object.keys(window.ElectronFiddle.editors).forEach((key) => {
      const editor = window.ElectronFiddle.editors[key];
      const disposable = editor.onDidChangeModelContent(() => {
        this.state.isUnsaved = true;
        disposable.dispose();
      });
    });
  }

  /**
   * Loads theme CSS into the HTML document.
   *
   * @returns {Promise<void>}
   */
  public async setupTheme(): Promise<void> {
    const tag: HTMLStyleElement | null = document.querySelector('style#fiddle-theme');
    const theme = await getTheme(this.state.theme);

    if (tag && theme.css) {
      tag.innerHTML = theme.css;
    }

    if (theme.isDark || theme.name.includes('dark')) {
      document.body.classList.add('bp3-dark');
    } else {
      document.body.classList.remove('bp3-dark');
    }
  }

  /**
   * We need to possibly recalculate the layout whenever the window
   * is resized. This method sets up the listener.
   */
  public setupResizeListener(): void {
    window.addEventListener('resize', updateEditorLayout);
  }
}

window.ElectronFiddle = window.ElectronFiddle || {};
window.ElectronFiddle.contentChangeListeners = window.ElectronFiddle.contentChangeListeners || [];
window.ElectronFiddle.app = window.ElectronFiddle.app || new App();
window.ElectronFiddle.app.setup();
