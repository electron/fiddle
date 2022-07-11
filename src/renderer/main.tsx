import * as monaco from 'monaco-editor';
import { App } from './app';
import { initSentry } from '../sentry';

initSentry();

window.ElectronFiddle.monaco = monaco;
window.ElectronFiddle.app = new App();
window.ElectronFiddle.app.setup();
