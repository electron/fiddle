import * as MonacoType from 'monaco-editor';
import { App } from './app';
import { initSentry } from '../sentry';

// Importing styles files
import '../less/root.less';

initSentry();

require('monaco-loader')().then((monaco: typeof MonacoType) => {
  window.ElectronFiddle.monaco = monaco;
  window.ElectronFiddle.app = new App();
  window.ElectronFiddle.app.setup();
});
