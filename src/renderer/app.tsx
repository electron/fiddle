import { initSentry } from '../sentry';
initSentry();

import { reaction, when } from 'mobx';
import * as MonacoType from 'monaco-editor';

import { ipcRenderer } from 'electron';
import {
  EditorValues,
  GenericDialogType,
  PACKAGE_NAME,
  SetFiddleOptions,
} from '../interfaces';
import { WEBCONTENTS_READY_FOR_IPC_SIGNAL } from '../ipc-events';
import { getPackageJson, PackageJsonOptions } from '../utils/get-package';
import { FileManager } from './file-manager';
import { RemoteLoader } from './remote-loader';
import { Runner } from './runner';
import { AppState } from './state';
import { getElectronVersions } from './versions';
import { TaskRunner } from './task-runner';
import { getTheme } from './themes';
import { defaultDark, defaultLight } from './themes-defaults';

/**
 * The top-level class controlling the whole app. This is *not* a React component,
 * but it does eventually render all components.
 *
 * @class App
 */
export class App {
  public typeDefDisposable: MonacoType.IDisposable | null = null;
  public monaco: typeof MonacoType | null = null;
  public state = new AppState(getElectronVersions());
  public fileManager = new FileManager(this.state);
  public remoteLoader = new RemoteLoader(this.state);
  public runner = new Runner(this.state);
  public readonly taskRunner: TaskRunner;

  constructor() {
    this.getEditorValues = this.getEditorValues.bind(this);

    this.taskRunner = new TaskRunner(this);
  }

  public async replaceFiddle(
    editorValues: EditorValues,
    { filePath, gistId, templateName }: Partial<SetFiddleOptions>,
  ) {
    // if unsaved, prompt user to make sure they're okay with overwriting and changing directory
    if (this.state.isUnsaved) {
      this.state.setGenericDialogOptions({
        type: GenericDialogType.warning,
        label: `Opening this Fiddle will replace your unsaved changes. Do you want to proceed?`,
        ok: 'Yes',
      });
      this.state.isGenericDialogShowing = true;
      await when(() => !this.state.isGenericDialogShowing);

      if (!this.state.genericDialogLastResult) {
        return false;
      }
    }

    await this.state.editorMosaic.set(editorValues);

    this.state.gistId = gistId || '';
    this.state.localPath = filePath;
    this.state.templateName = templateName;
    this.state.isUnsaved = false;

    return true;
  }

  /**
   * Retrieves the contents of all editor panes.
   *
   * @returns {EditorValues}
   */
  public async getEditorValues(
    options?: PackageJsonOptions,
  ): Promise<EditorValues> {
    const values = this.state.editorMosaic.values();

    if (options && options.include !== false) {
      values[PACKAGE_NAME] = await getPackageJson(this.state, values, options);
    }

    return values;
  }

  /**
   * Initial setup call, loading Monaco and kicking off the React
   * render process.
   */
  public async setup(): Promise<void | Element | React.Component> {
    this.loadTheme();

    const React = await import('react');
    const { render } = await import('react-dom');
    const { Dialogs } = await import('./components/dialogs');
    const { OutputEditorsWrapper } = await import(
      './components/output-editors-wrapper'
    );
    const { Header } = await import('./components/header');

    const className = `${process.platform} container`;
    const app = (
      <div className={className}>
        <Dialogs appState={this.state} />
        <Header appState={this.state} />
        <OutputEditorsWrapper appState={this.state} />
      </div>
    );

    const rendered = render(app, document.getElementById('app'));

    this.setupResizeListener();
    this.setupThemeListeners();
    this.setupTitleListeners();

    ipcRenderer.send(WEBCONTENTS_READY_FOR_IPC_SIGNAL);

    return rendered;
  }

  public async setupThemeListeners() {
    const setSystemTheme = (prefersDark: boolean) => {
      if (prefersDark) {
        this.state.setTheme(defaultDark.file);
      } else {
        this.state.setTheme(defaultLight.file);
      }
    };

    // match theme to system when box is ticked
    reaction(
      () => this.state.isUsingSystemTheme,
      () => {
        if (this.state.isUsingSystemTheme && !!window.matchMedia) {
          const { matches } = window.matchMedia('(prefers-color-scheme: dark)');
          setSystemTheme(matches);
        }
      },
    );

    // change theme when system theme changes
    if (!!window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', ({ matches }) => {
          if (this.state.isUsingSystemTheme) {
            setSystemTheme(matches);
          }
        });
    }
  }

  /**
   * Opens a fiddle from the specified location.
   *
   * @param {SetFiddleOptions} the fiddle to open
   */
  public async openFiddle(fiddle: SetFiddleOptions) {
    const { filePath, gistId } = fiddle;
    if (filePath) {
      await this.fileManager.openFiddle(filePath);
    } else if (gistId) {
      await this.remoteLoader.fetchGistAndLoad(gistId);
    }
  }

  /**
   * Loads theme CSS into the HTML document.
   *
   * @returns {Promise<void>}
   */
  public async loadTheme(): Promise<void> {
    const tag: HTMLStyleElement | null = document.querySelector(
      'style#fiddle-theme',
    );
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
    window.addEventListener('resize', this.state.editorMosaic.layout);
  }

  /**
   * Have document.title track state.title
   */
  public setupTitleListeners() {
    // the observables used for the title usually change in a batch,
    // so when setting document title, wait a tick to avoid flicker.
    let titleIdle: any;
    reaction(
      () => this.state.title,
      (title) => {
        clearTimeout(titleIdle);
        titleIdle = setTimeout(() => {
          document.title = title;
          titleIdle = null;
        });
      },
    );
  }
}

window.ElectronFiddle = window.ElectronFiddle || {};
window.ElectronFiddle.contentChangeListeners ||= [];
window.ElectronFiddle.app ||= new App();
window.ElectronFiddle.app.setup();
