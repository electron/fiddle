const { configure: enzymeConfigure } = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
const { createSerializer } = require('enzyme-to-json');
const { configure: mobxConfigure } = require('mobx');

const { ElectronFiddleMock } = require('./mocks/mocks');

enzymeConfigure({ adapter: new Adapter() });

// allow jest fns to overwrite readonly mobx stuff
// https://mobx.js.org/configuration.html#safedescriptors-boolean
mobxConfigure({ safeDescriptors: false });
require('@testing-library/jest-dom/extend-expect');

global.confirm = jest.fn();

if (!process.env.FIDDLE_VERBOSE_TESTS) {
  jest.spyOn(global.console, 'error').mockImplementation(() => jest.fn());
  jest.spyOn(global.console, 'info').mockImplementation(() => jest.fn());
  jest.spyOn(global.console, 'log').mockImplementation(() => jest.fn());
  jest.spyOn(global.console, 'warn').mockImplementation(() => jest.fn());
  jest.spyOn(global.console, 'debug').mockImplementation(() => jest.fn());
}
jest.mock('electron', () => require('./mocks/electron'));
jest.mock('fs-extra');

// Disable Sentry in tests
jest.mock('@sentry/electron/main', () => ({
  init: jest.fn(),
}));
jest.mock('@sentry/electron/renderer', () => ({
  init: jest.fn(),
}));

class FakeBroadcastChannel {
  listeners = [];

  addEventListener = (_, callback) => {
    this.listeners.push(callback);
  };

  postMessage = (message) => {
    for (const listener of this.listeners) {
      listener(new MessageEvent('message', { data: message }));
    }
  };
}

global.BroadcastChannel = class Singleton {
  static instance = new FakeBroadcastChannel();

  constructor(_) {
    return Singleton.instance;
  }
};

expect.addSnapshotSerializer(createSerializer({ mode: 'deep' }));

// We want to detect jest sometimes
global.__JEST__ = global.__JEST__ || {};

// Setup for main tests
global.window = global.window || {};
global.document = global.document || { body: {} };
global.fetch = window.fetch = jest.fn();

delete window.localStorage;
window.localStorage = {};

window.navigator = window.navigator ?? {};
window.navigator.clipboard = {};

/**
 * Mock these properties twice so that they're available
 * both at the top-level of files and also within the
 * code called in individual tests.
 */
window.ElectronFiddle = new ElectronFiddleMock();
window.localStorage.setItem = jest.fn();
window.localStorage.getItem = jest.fn();
window.localStorage.removeItem = jest.fn();
window.open = jest.fn();
window.navigator.clipboard.readText = jest.fn();
window.navigator.clipboard.writeText = jest.fn();

beforeEach(() => {
  process.env.JEST = true;
  process.env.TEST = true;
  document.body.innerHTML = '<div id="app" />';

  window.ElectronFiddle = new ElectronFiddleMock();
  window.localStorage.setItem.mockReset();
  window.localStorage.getItem.mockReset();
  window.localStorage.removeItem.mockReset();
  window.open.mockReset();
});
