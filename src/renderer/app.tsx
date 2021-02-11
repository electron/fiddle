import { initSentry } from '../sentry';
initSentry();

import { reaction, when } from 'mobx';
import * as MonacoType from 'monaco-editor';

import { ipcRenderer } from 'electron';
import {
  ALL_EDITORS,
  EditorId,
  EditorValues,
  GenericDialogType,
  SetFiddleOptions,
} from '../interfaces';
import { WEBCONTENTS_READY_FOR_IPC_SIGNAL } from '../ipc-events';
import { updateEditorLayout } from '../utils/editor-layout';
import { getEditorValue } from '../utils/editor-value';
import { getPackageJson, PackageJsonOptions } from '../utils/get-package';
import { getTitle } from '../utils/get-title';
import { isEditorBackup } from '../utils/type-checks';
import { EMPTY_EDITOR_CONTENT } from './constants';
import { FileManager } from './file-manager';
import { RemoteLoader } from './remote-loader';
import { Runner } from './runner';
import { appState } from './state';
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
  public state = appState;
  public fileManager = new FileManager(appState);
  public remoteLoader = new RemoteLoader(appState);
  public runner = new Runner(appState);

  constructor() {
    this.getEditorValues = this.getEditorValues.bind(this);
    this.setEditorValues = this.setEditorValues.bind(this);
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

    // display all editors that have content
    const visibleEditors = [];

    // ensure consistent sorting of mosaics
    const sortedEditors = Object.keys(editorValues).sort((a, b) => {
      const order: Array<string> = [
        'main',
        'renderer',
        'html',
        'preload',
        'css',
      ];

      return order.indexOf(a) - order.indexOf(b);
    });

    for (const id of sortedEditors) {
      const content = editorValues[id];

      // if the gist content is empty or matches the empty file output, don't show it
      if (
        content.length > 0 &&
        !Object.values(EMPTY_EDITOR_CONTENT).includes(content)
      ) {
        visibleEditors.push(id as EditorId);
      }
    }

    this.state.gistId = gistId || '';
    this.state.localPath = filePath;
    this.state.templateName = templateName;

    // once loaded, we have a "saved" state
    await this.state.setVisibleMosaics(visibleEditors);
    await this.setEditorValues(editorValues);
    this.state.isUnsaved = false;

    document.title = getTitle(this.state);

    return true;
  }

  /**
   * Sets the contents of all editor panes.
   *
   * @param {EditorValues} values
   */
  public async setEditorValues(values: Partial<EditorValues>): Promise<void> {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle) {
      throw new Error('Fiddle not ready');
    }

    for (const name of ALL_EDITORS) {
      const editor = fiddle.editors[name];
      const backup = this.state.closedPanels[name];

      if (typeof values[name] !== 'undefined') {
        if (isEditorBackup(backup)) {
          // The editor does not exist, attempt to set it on the backup.
          // If there's a model, we'll do it on the model. Else, we'll
          // set the value.

          if (backup.model) {
            backup.model.setValue(values[name]!);
          } else {
            backup.value = values[name]!;
          }
        } else if (editor && editor.setValue) {
          // The editor exists, set the value directly
          editor.setValue(values[name]!);
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

    if (!fiddle) {
      throw new Error('Fiddle not ready');
    }

    const values: EditorValues = {
      css: getEditorValue(EditorId.css),
      html: getEditorValue(EditorId.html),
      main: getEditorValue(EditorId.main),
      preload: getEditorValue(EditorId.preload),
      renderer: getEditorValue(EditorId.renderer),
    };

    if (options && options.include !== false) {
      values.package = await getPackageJson(this.state, values, options);
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
}

window.ElectronFiddle = window.ElectronFiddle || {};
window.ElectronFiddle.contentChangeListeners =
  window.ElectronFiddle.contentChangeListeners || [];
window.ElectronFiddle.app = window.ElectronFiddle.app || new App();
window.ElectronFiddle.app.setup();
