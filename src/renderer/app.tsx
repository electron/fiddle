import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faClipboardList,
  faCloudDownloadAlt,
  faKey,
  faSignInAlt,
  faSignOutAlt,
  faSpinner,
  faTerminal,
  faTimesCircle,
  faTrash,
  faUpload
} from '@fortawesome/free-solid-svg-icons';
import * as MonacoType from 'monaco-editor';

import { EditorValues } from '../interfaces';
import { updateEditorLayout } from '../utils/editor-layout';
import { getPackageJson, PackageJsonOptions } from '../utils/get-package';
import { FileManager } from './file-manager';
import { appState } from './state';
import { getTheme } from './themes';

library.add(
  faClipboardList,
  faCloudDownloadAlt,
  faKey,
  faSignInAlt,
  faSignOutAlt,
  faSpinner,
  faTerminal,
  faTimesCircle,
  faTrash,
  faUpload
);

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

  constructor() {
    this.getValues = this.getValues.bind(this);
    this.setValues = this.setValues.bind(this);
  }

  /**
   * Sets the values on all three editors.
   *
   * @param {EditorValues} values
   */
  public async setValues(values: Partial<EditorValues>): Promise<boolean> {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle) {
      throw new Error('Fiddle not ready');
    }

    if (appState.isUnsaved) {
      const isUserSure = confirm('Your current fiddle is unsaved. Are you sure you want to overwrite it?');
      if (!isUserSure) return false;
    }

    const { main, html, renderer } = fiddle.editors;

    if (html && html.setValue && values.html) {
      html.setValue(values.html);
    }

    if (main && main.setValue && values.main) {
      main.setValue(values.main);
    }

    if (renderer && renderer.setValue && values.renderer) {
      renderer.setValue(values.renderer);
    }

    appState.isUnsaved = false;
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

    const { main, html, renderer } = fiddle.editors;
    const values: EditorValues = {
      html: html && html.getValue() ? html.getValue() : '',
      main: main && main.getValue() ? main.getValue() : '',
      renderer: renderer && renderer.getValue() ? renderer.getValue() : '',
    };

    if (options && options.include !==  false) {
      values.package = await getPackageJson(appState, values, options);
    }

    return values;
  }

  /**
   * Initial setup call, loading Monaco and kicking off the React
   * render process.
   */
  public async setup(): Promise<void> {
    this.setupTheme();

    const React = await import('react');
    const { render } = await import('react-dom');
    const { Header } = await import('./components/header');
    const { Dialogs } = await import('./components/dialogs');
    const { Editors } = await import('./components/editors');

    const className = `${process.platform} container`;
    const app = (
      <div className={className}>
        <Header appState={appState} />
        <Dialogs appState={appState} />
        <Editors appState={appState} />
      </div>
    );

    render(app, document.getElementById('app'));

    this.setupResizeListener();

    // Todo: A timer here is terrible. Let's fix this
    // and ensure we actually do it once Editors have mounted.
    setTimeout(() => {
      this.setupUnsavedOnChangeListener();
    }, 1500);
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
        appState.isUnsaved = true;
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
    const theme = await getTheme(appState.theme);

    if (tag && theme.css) {
      tag.innerHTML = theme.css;
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

// tslint:disable-next-line:no-string-literal
if (!process.env.TEST && !process.env.JEST_WORKER_ID) {
  window.ElectronFiddle.contentChangeListeners = [];
  window.ElectronFiddle.app = new App();
  window.ElectronFiddle.app.setup()
    .catch((error) => console.error(error));
}
