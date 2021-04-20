import { initSentry } from '../sentry';
initSentry();

import { autorun, reaction, when } from 'mobx';
import * as MonacoType from 'monaco-editor';

import { ipcRenderer } from 'electron';
import {
  EditorValues,
  GenericDialogType,
  SetFiddleOptions,
  PACKAGE_NAME,
} from '../interfaces';
import { IpcEvents, WEBCONTENTS_READY_FOR_IPC_SIGNAL } from '../ipc-events';
import { getPackageJson, PackageJsonOptions } from '../utils/get-package';
import { AppState } from './state';
import { EditorMosaic } from './editor-mosaic';
import { FileManager } from './file-manager';
import { RemoteLoader } from './remote-loader';
import { Runner } from './runner';
import { TaskRunner } from './task-runner';
import { getElectronVersions } from './versions';
import { getTemplate } from './content';
import { getTheme } from './themes';
import { defaultDark, defaultLight } from './themes-defaults';
import { ipcRendererManager } from './ipc';

/**
 * The top-level class controlling the whole app. This is *not* a React component,
 * but it does eventually render all components.
 *
 * @class App
 */
export class App {
  public typeDefDisposable: MonacoType.IDisposable | null = null;
  public monaco: typeof MonacoType | undefined;
  public state = new AppState(getElectronVersions());
  public readonly editorMosaic = new EditorMosaic(this);
  public fileManager = new FileManager(this.state, this);
  public remoteLoader = new RemoteLoader(this.state);
  public runner = new Runner(this.state);
  public readonly taskRunner = new TaskRunner(this);

  constructor() {
    this.getEditorValues = this.getEditorValues.bind(this);
  }

  private async confirmUnsaved(): Promise<boolean> {
    const { state } = this;

    state.setGenericDialogOptions({
      type: GenericDialogType.warning,
      label: `Opening this Fiddle will replace your unsaved changes. Do you want to proceed?`,
      ok: 'Yes',
    });
    state.isGenericDialogShowing = true;
    await when(() => !state.isGenericDialogShowing);

    return !!state.genericDialogLastResult;
  }

  public async replaceFiddle(
    editorValues: EditorValues,
    { filePath, gistId, templateName }: Partial<SetFiddleOptions>,
  ) {
    const { editorMosaic, state } = this;

    // if unsaved, prompt user to make sure they're okay with overwriting and changing directory
    if (editorMosaic.isEdited && !(await this.confirmUnsaved())) return false;

    this.editorMosaic.set(editorValues);

    state.gistId = gistId || '';
    state.localPath = filePath;
    state.templateName = templateName;

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
    const values = this.editorMosaic.values();

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
        <Header appState={this.state} editorMosaic={this.editorMosaic} />
        <OutputEditorsWrapper
          appState={this.state}
          editorMosaic={this.editorMosaic}
        />
      </div>
    );

    const rendered = render(app, document.getElementById('app'));

    this.setupResizeListener();
    this.setupThemeListeners();
    this.setupTitleListeners();
    this.setupUnloadListeners();

    ipcRenderer.send(WEBCONTENTS_READY_FOR_IPC_SIGNAL);

    // load the initial fiddle
    const { version } = this.state;
    const values = await getTemplate(version);
    this.replaceFiddle(values, { templateName: version });

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
   * Recalculate the layout whenever the window is resized.
   * This method sets up the listener.
   */
  public setupResizeListener(): void {
    window.addEventListener('resize', () => this.editorMosaic.layout());
  }

  /**
   * Have document.title track state.title
   */
  public setupTitleListeners() {
    let debounce: any;
    autorun(() => {
      const { title } = this.state;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        document.title = title;
        debounce = null;
      });
    });
  }

  public setupUnloadListeners() {
    autorun(async () => {
      const { editorMosaic, state } = this;

      if (!editorMosaic.isEdited) {
        window.onbeforeunload = null;
      } else {
        window.onbeforeunload = () => {
          ipcRendererManager.send(IpcEvents.SHOW_INACTIVE);
          state.setGenericDialogOptions({
            label: `The current Fiddle is unsaved. Do you want to exit anyway?`,
            ok: 'Exit',
            type: GenericDialogType.warning,
          });

          state.isGenericDialogShowing = true;

          // We'll wait until the warning dialog was closed
          when(() => !state.isGenericDialogShowing).then(() => {
            const closeConfirmed = state.genericDialogLastResult;
            // The user confirmed, let's close for real.
            if (closeConfirmed) {
              // isQuitting checks if we're trying to quit the app
              // or just close the window
              if (state.isQuitting) {
                ipcRendererManager.send(IpcEvents.CONFIRM_QUIT);
              }
              window.onbeforeunload = null;
              window.close();
            }
          });

          // return value doesn't matter, we just want to cancel the event
          return false;
        };
      }
    });
  }
}

window.ElectronFiddle = window.ElectronFiddle || {};
window.ElectronFiddle.app ||= new App();
window.ElectronFiddle.app.setup();
