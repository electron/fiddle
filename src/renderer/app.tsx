import * as MonacoType from 'monaco-editor';

import { EditorValues } from '../interfaces';
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
  public name = 'test';
  public typeDefDisposable: MonacoType.IDisposable | null = null;
  public monaco: typeof MonacoType | null = null;

  //@ts-ignore: We're not using this, but we do want to create it
  private fileManager = new FileManager();

  constructor() {
    this.getValues = this.getValues.bind(this);
    this.setValues = this.setValues.bind(this);
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
  public async getValues(options: PackageJsonOptions): Promise<EditorValues> {
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

    values.package = await getPackageJson(appState, values, options);

    return values;
  }

  /**
   * Initial setup call, loading Monaco and kicking off the React
   * render process.
   */
  public async setup(): Promise<void> {
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

    render(app, document.getElementById('app'), () => {
      ipcRendererManager.send(IpcEvents.MAIN_WINDOW_READY_TO_SHOW);
    });

    this.setupResizeListener();
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
window.ElectronFiddle.app = new App();
window.ElectronFiddle.app.setup();
