import { initSentry } from '../sentry';
initSentry();

import { reaction, when } from 'mobx';
import * as MonacoType from 'monaco-editor';

import { ipcRenderer } from 'electron';
import {
  DefaultEditorId,
  EditorValues,
  GenericDialogType,
  SetFiddleOptions,
  EditorId,
  CustomEditorId,
  PACKAGE_NAME,
  DEFAULT_EDITORS,
} from '../interfaces';
import { WEBCONTENTS_READY_FOR_IPC_SIGNAL } from '../ipc-events';
import { updateEditorLayout } from '../utils/editor-layout';
import { getEditorValue } from '../utils/editor-value';
import { getPackageJson, PackageJsonOptions } from '../utils/get-package';
import { compareEditors, getEmptyContent } from '../utils/editor-utils';
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
    this.setEditorValues = this.setEditorValues.bind(this);

    this.taskRunner = new TaskRunner(this);
  }

  public async replaceFiddle(
    editorValues: Partial<EditorValues>,
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

    // Remove all previously created custom editors.
    this.state.customMosaics = [];
    const customEditors = Object.keys(editorValues).filter(
      (v) => !Object.values(DefaultEditorId).includes(v as DefaultEditorId),
    ) as CustomEditorId[];

    // Re-add new custom editors.
    for (const mosaic of customEditors) {
      this.state.customMosaics.push(mosaic);
    }

    // If the gist content is empty or matches the empty file output, don't show it.
    const shouldShow = (id: EditorId, val?: string) => {
      return !!val && val.length > 0 && val !== getEmptyContent(id);
    };

    // Sort and display all editors that have content.
    const visibleEditors: EditorId[] = Object.entries(editorValues)
      .filter(([id, content]) => shouldShow(id as EditorId, content))
      .map(([id]) => id as DefaultEditorId)
      .sort(compareEditors);

    this.state.gistId = gistId || '';
    this.state.localPath = filePath;
    this.state.templateName = templateName;

    // Once loaded, we have a "saved" state.
    await this.state.setVisibleMosaics(visibleEditors);
    await this.setEditorValues(editorValues);
    this.state.isUnsaved = false;

    return true;
  }

  /**
   * Sets the contents of all editor panes.
   *
   * @param {EditorValues} values
   */
  public async setEditorValues(values: Partial<EditorValues>): Promise<void> {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle?.app) {
      throw new Error('Fiddle not ready');
    }

    // Set content for mosaics.
    const allEditors = [...this.state.customMosaics, ...DEFAULT_EDITORS];
    for (const name of allEditors) {
      const editor = fiddle.editors[name];
      if (typeof values[name] !== 'undefined') {
        const backup = this.state.closedPanels[name];
        if (backup) {
          // The editor does not exist, attempt to set it on the backup.
          // If there's a model, we'll do it on the model. Else, we'll
          // set the value.

          if (backup.model) {
            backup.model.setValue(values[name]!);
          } else {
            backup.value = values[name]!;
          }
        } else if (editor?.setValue) {
          // The editor exists, set the value directly
          const newValue = values[name]!;
          if (!editor.getValue || editor.getValue() !== newValue) {
            editor.setValue(newValue);
          }
        }
      }
    }
  }

  /**
   * Retrieves the contents of all editor panes.
   *
   * @returns {EditorValues}
   */
  public async getEditorValues(
    options?: PackageJsonOptions,
  ): Promise<EditorValues> {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle?.app) {
      throw new Error('Fiddle not ready');
    }

    const values = {} as EditorValues;
    for (const editor in fiddle?.editors) {
      values[editor] = getEditorValue(editor as EditorId);
    }

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
    window.addEventListener('resize', updateEditorLayout);
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
