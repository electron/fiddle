import * as MonacoType from 'monaco-editor';
import { App } from './app';
import { activateTheme } from './themes';
import { initSentry } from '../sentry';

initSentry();

require('monaco-loader')()
  .then((mon: typeof MonacoType) => (window.ElectronFiddle.app = new App(mon)))
  .then(() => activateTheme())
  .then(() => window.ElectronFiddle.app.setup());
