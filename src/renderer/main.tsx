import * as MonacoType from 'monaco-editor';
import { App } from './app';
import { initSentry } from '../sentry';

initSentry();

require('monaco-loader')().then((monaco: typeof MonacoType) => {
  window.ElectronFiddle.monaco = monaco;
  window.ElectronFiddle.app = new App();
  window.ElectronFiddle.app.setup();
});
