import * as React from 'react';
import { render } from 'react-dom';
import * as loader from 'monaco-loader';
import { observable } from 'mobx';
import * as MonacoType from 'monaco-editor';

import { mainTheme } from './themes';
import { getContent } from './content';
import { Header } from './components/header';
import { BinaryManager } from './binary';
import { ElectronVersion, StringMap, OutputEntry } from '../interfaces';
import { arrayToStringMap } from '../utils/array-to-stringmap';
import { getKnownVersions } from './versions';
import { normalizeVersion } from '../utils/normalize-version';

const knownVersions = getKnownVersions();
const defaultVersion = normalizeVersion(knownVersions[0].tag_name);

export class AppState {
  @observable public version: string = defaultVersion;
  @observable public binaryManager: BinaryManager = new BinaryManager(defaultVersion);
  @observable public versions: StringMap<ElectronVersion> = arrayToStringMap(knownVersions);
  @observable public output: Array<OutputEntry> = [];
  @observable public isConsoleShowing: boolean = false;
}

const appState = new AppState();

class App {
  public editors: any = {
    main: null,
    renderer: null,
    html: null
  };
  public monaco: typeof MonacoType | null = null;
  public name = 'test';
  public typeDefDisposable = null;

  constructor() {
    this.getValues = this.getValues.bind(this);

    this.setup();
  }

  private async setup() {
    this.monaco = await loader();

    this.createThemes();
    this.editors.html = this.createEditor('html');
    this.editors.main = this.createEditor('main');
    this.editors.renderer = this.createEditor('renderer');

    render(<Header appState={appState} />, document.getElementById('header'));
  }

  private createThemes() {
    if (!this.monaco) return;

    this.monaco.editor.defineTheme('main', mainTheme as any);
  }

  private createEditor(id: string) {
    if (!this.monaco) throw new Error('Monaco not ready');

    const element = document.getElementById(`editor-${id}`);
    const language = id === 'html' ? 'html' : 'javascript';
    const value = getContent(id);

    const options = {
      language,
      theme: 'main',
      automaticLayout: true,
      minimap: {
        enabled: false
      },
      value
    };

    return this.monaco.editor.create(element!, options);
  }

  private getValues() {
    if (!this.editors.html || !this.editors.main || !this.editors.renderer) {
      throw new Error('Editors not ready');
    }

    return {
      html: this.editors.html!.getValue(),
      main: this.editors.main!.getValue(),
      renderer: this.editors.renderer!.getValue(),
      package: JSON.stringify({
        name: this.name,
        main: './main.js',
        version: '1.0.0'
      })
    };
  }
}

// tslint:disable-next-line:no-string-literal
window['electronFiddle'] = new App();
