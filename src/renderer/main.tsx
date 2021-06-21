import * as MonacoType from 'monaco-editor';
import { App } from './app';
import { initSentry } from '../sentry';

initSentry();

require('monaco-loader')().then((mon: typeof MonacoType) => {
  window.ElectronFiddle.app = new App(mon);
  window.ElectronFiddle.app.setup();
});
