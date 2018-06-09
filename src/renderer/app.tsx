import * as React from 'react';
import { render } from 'react-dom';
import * as loader from 'monaco-loader';
import { observable } from 'mobx';
import * as MonacoType from 'monaco-editor';

import { mainTheme } from './themes';
import { Header } from './components/header';
import { BinaryManager } from './binary';
import { ElectronVersion, StringMap, OutputEntry } from '../interfaces';
import { arrayToStringMap } from '../utils/array-to-stringmap';
import { getKnownVersions } from './versions';
import { normalizeVersion } from '../utils/normalize-version';
import { editors } from './components/editors';
import { updateEditorLayout } from '../utils/editor-layout';

const knownVersions = getKnownVersions();
const defaultVersion = normalizeVersion(knownVersions[0].tag_name);

window.ElectronFiddle = {
  editors: {
    main: null,
    renderer: null,
    html: null
  },
  app: null
};

export class AppState {
  @observable public gistId: string = '';
  @observable public version: string = defaultVersion;
  @observable public githubToken: string | null = null;
  @observable public binaryManager: BinaryManager = new BinaryManager(defaultVersion);
  @observable public versions: StringMap<ElectronVersion> = arrayToStringMap(knownVersions);
  @observable public output: Array<OutputEntry> = [];
  @observable public isConsoleShowing: boolean = false;
  @observable public isTokenDialogShowing: boolean = false;
  @observable public isUnsaved: boolean = true;
  @observable public isMyGist: boolean = false;
}

const appState = new AppState();
appState.githubToken = localStorage.getItem('githubToken');

class App {
  public editors: {
    main: MonacoType.editor.IStandaloneCodeEditor | null,
    renderer: MonacoType.editor.IStandaloneCodeEditor | null,
    html: MonacoType.editor.IStandaloneCodeEditor | null,
  } = {
    main: null,
    renderer: null,
    html: null
  };
  public monaco: typeof MonacoType | null = null;
  public name = 'test';
  public typeDefDisposable = null;
  public isScrollbarHidden = false;

  constructor() {
    this.getValues = this.getValues.bind(this);

    this.setup();
  }

  public setValues(values: {
    html: string;
    main: string;
    renderer: string;
  }) {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle.editors.html || !fiddle.editors.main || !fiddle.editors.renderer) {
      throw new Error('Editors not ready');
    }

    fiddle.editors.html.setValue(values.html);
    fiddle.editors.main.setValue(values.main);
    fiddle.editors.renderer.setValue(values.renderer);
  }

  public getValues() {
    const { ElectronFiddle: fiddle } = window;

    if (!fiddle.editors.html || !fiddle.editors.main || !fiddle.editors.renderer) {
      throw new Error('Editors not ready');
    }

    return {
      html: fiddle.editors.html.getValue(),
      main: fiddle.editors.main.getValue(),
      renderer: fiddle.editors.renderer.getValue(),
      package: JSON.stringify({
        name: this.name,
        main: './main.js',
        version: '1.0.0'
      })
    };
  }

  public async setup() {
    this.monaco = await loader();
    this.createThemes();

    const app = (
      <div>
        <Header appState={appState} />
        {editors({ monaco: this.monaco!, appState })}å
      </div>
    );

    render(app, document.getElementById('app'));

    this.setupResizeListener();
  }

  public setupResizeListener() {
    window.addEventListener('resize', updateEditorLayout);
  }

  public createThemes() {
    if (!this.monaco) return;
    this.monaco.editor.defineTheme('main', mainTheme as any);
  }
}

// tslint:disable-next-line:no-string-literal
window.ElectronFiddle.app = new App();
