import { initSentry } from '../sentry';
import { App } from './app';

initSentry();

window.ElectronFiddle.app ||= new App();
window.ElectronFiddle.app.setup();
