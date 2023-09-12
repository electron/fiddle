import * as monaco from 'monaco-editor';

import { App } from './app';
import { initSentry } from './sentry';

initSentry();

window.monaco = monaco;
window.app = new App();
window.app.setup();
