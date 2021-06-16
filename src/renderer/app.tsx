import { initSentry } from '../sentry';
initSentry();

import { autorun, reaction } from 'mobx';
import * as MonacoType from 'monaco-editor';

import { ipcRenderer } from 'electron';
import { ipcRendererManager } from './ipc';
import {
  EditorValues,
  GenericDialogType,
  PACKAGE_NAME,
  SetFiddleOptions,
} from '../interfaces';
import { WEBCONTENTS_READY_FOR_IPC_SIGNAL, IpcEvents } from '../ipc-events';
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

  private async confirmReplaceUnsaved() {
    return this.state.runConfirmationDialog({
      label: `Opening this Fiddle will replace your unsaved changes. Do you want to proceed?`,
      ok: 'Yes',
      type: GenericDialogType.warning,
    });
  }

  private async confirmExitUnsaved() {
    return this.state.runConfirmationDialog({
      label: 'The current Fiddle is unsaved. Do you want to exit anyway?',
      ok: 'Exit',
      type: GenericDialogType.warning,
    });
  }

  public async replaceFiddle(
    editorValues: EditorValues,
    { filePath, gistId, templateName }: Partial<SetFiddleOptions>,
  ) {
    const { state } = this;
    const { editorMosaic } = state;

    if (editorMosaic.isEdited && !(await this.confirmReplaceUnsaved())) {
      return false;
    }

    this.state.editorMosaic.set(editorValues);

    this.state.gistId = gistId || '';
    this.state.localPath = filePath;
    this.state.templateName = templateName;

    // update menu when a new Fiddle is loaded
    ipcRenderer.send(IpcEvents.SET_SHOW_ME_TEMPLATE, templateName);

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
    this.setupUnloadListeners();

    ipcRenderer.send(WEBCONTENTS_READY_FOR_IPC_SIGNAL);

    ipcRenderer.on(IpcEvents.SET_SHOW_ME_TEMPLATE, () => {
      ipcRenderer.send(IpcEvents.SET_SHOW_ME_TEMPLATE, this.state.templateName);
    });

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

  public setupUnloadListeners() {
    autorun(async () => {
      const { state } = this;
      const { editorMosaic } = state;

      if (!editorMosaic.isEdited) {
        window.onbeforeunload = null;
        return;
      }

      window.onbeforeunload = async () => {
        if (await this.confirmExitUnsaved()) {
          // isQuitting checks if we're trying to quit the app
          // or just close the window
          if (state.isQuitting) {
            ipcRendererManager.send(IpcEvents.CONFIRM_QUIT);
          }
          window.onbeforeunload = null;
          window.close();
        }

        // return value doesn't matter, we just want to cancel the event
        return false;
      };
    });
  }
}

window.ElectronFiddle = window.ElectronFiddle || {};
window.ElectronFiddle.contentChangeListeners ||= [];
window.ElectronFiddle.app ||= new App();
window.ElectronFiddle.app.setup();
