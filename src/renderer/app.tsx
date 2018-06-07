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

  public async setup() {
    this.monaco = await loader();

    this.createThemes();
    this.setupDrag();
    this.editors.html = this.createEditor('html');
    this.editors.main = this.createEditor('main');
    this.editors.renderer = this.createEditor('renderer');

    render(<Header appState={appState} />, document.getElementById('header'));
  }

  public setupDrag() {
    const resizers = Array.from(document.getElementsByClassName('resize'));
    const elements = [
      document.getElementById(`editor-main`),
      document.getElementById(`editor-renderer`),
      document.getElementById(`editor-html`),
    ];

    resizers.forEach((resizer, i) => {
      resizer.addEventListener('mousedown', (event: MouseEvent) => {
        const increaseElement = elements[i]!;
        const decreaseElement = elements[i + 1]!;
        const computedStyleIncrease = document.defaultView.getComputedStyle(increaseElement);
        const computedStyleDecrease = document.defaultView.getComputedStyle(increaseElement);

        const startX = event.clientX;
        const startWidthIncrease = parseInt(computedStyleIncrease.width!, 10);
        const startWidthDecrease = parseInt(computedStyleDecrease.width!, 10);

        function doDrag(e: MouseEvent) {
          e.preventDefault();

          const deltaWidth = e.clientX - startX;
          increaseElement.style.width = (startWidthIncrease + deltaWidth) + 'px';
          decreaseElement.style.width = (startWidthDecrease + -1 * deltaWidth) + 'px';
        }

        function stopDrag(e: MouseEvent) {
          e.preventDefault();
          document.onmousemove = null;
          document.onmouseup = null;
        }

        document.onmousemove = doDrag;
        document.onmouseup = stopDrag;
      });
    });
  }

  public createThemes() {
    if (!this.monaco) return;

    this.monaco.editor.defineTheme('main', mainTheme as any);
  }

  public createEditor(id: string) {
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

  public getValues() {
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
