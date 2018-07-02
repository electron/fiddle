import * as React from 'react';
import { render } from 'react-dom';
import * as loader from 'monaco-loader';
import * as MonacoType from 'monaco-editor';

import { mainTheme } from './themes';
import { Header } from './components/header';
import { Dialogs } from './components/dialogs';
import { EditorValues } from '../interfaces';
import { editors } from './components/editors';
import { updateEditorLayout } from '../utils/editor-layout';
import { appState } from './state';
import { ipcRendererManager } from './ipc';
import { IpcEvents } from '../ipc-events';
import { FileManager } from './file-manager';
import { getPackageJson, PackageJsonOptions } from '../utils/get-package';

/**
 * The top-level class controlling the whole app. This is *not* a React component,
 * but it does eventually render all components.
 *
 * @class App
 */
export class App {
  public monaco: typeof MonacoType | null = null;
  public name = 'test';
  public typeDefDisposable: MonacoType.IDisposable | null = null;

  //@ts-ignore: We're not using this, but we do want to create it
  private fileManager = new FileManager();

  constructor() {
    this.getValues = this.getValues.bind(this);
    this.setup();
  }

  /**
   * Sets the values on all three editors.
   *
   * @param {EditorValues} values
   */
  public setValues(values: EditorValues): void {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle) {
      throw new Error('Fiddle not ready');
    }

    const { main, html, renderer } = fiddle.editors;

    if (html && html.setValue) html.setValue(values.html);
    if (main && main.setValue) main.setValue(values.main);
    if (renderer && renderer.setValue) renderer.setValue(values.renderer);
  }

  /**
   * Gets the values on all three editors.
   *
   * @returns {EditorValues}
   */
  public getValues(options: PackageJsonOptions): EditorValues {
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

    values.package = getPackageJson(appState, values, options);

    return values;
  }

  /**
   * Initial setup call, loading Monaco and kicking off the React
   * render process.
   */
  public async setup(): Promise<void> {
    this.monaco = await loader();
    this.createThemes();

    const className = `${process.platform} container`;
    const app = (
      <div className={className}>
        <Header appState={appState} />
        <Dialogs appState={appState} />
        {editors({ monaco: this.monaco!, appState })}
      </div>
    );

    ipcRendererManager.send(IpcEvents.MAIN_WINDOW_READY_TO_SHOW);
    render(app, document.getElementById('app'));

    this.setupResizeListener();
  }

  /**
   * We need to possibly recalculate the layout whenever the window
   * is resized. This method sets up the listener.
   */
  public setupResizeListener(): void {
    window.addEventListener('resize', updateEditorLayout);
  }

  /**
   * We have a custom theme for the Monaco editor. This sets that up.
   */
  public createThemes(): void {
    if (!this.monaco) return;
    this.monaco.editor.defineTheme('main', mainTheme as any);
  }
}

// tslint:disable-next-line:no-string-literal
window.ElectronFiddle.app = new App();
