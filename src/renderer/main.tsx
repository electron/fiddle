import * as monaco from 'monaco-editor';

import { initSentry } from '../sentry';
import { App } from './app';

initSentry();

window.ElectronFiddle.monaco = monaco;
window.ElectronFiddle.app = new App();
window.ElectronFiddle.app.setup();
