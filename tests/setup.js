const { configure } = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
const { ElectronFiddleMock } = require('./mocks/mocks');
const { createSerializer } = require('enzyme-to-json');

configure({ adapter: new Adapter() });

global.confirm = jest.fn();

if (!process.env.hasOwnProperty('FIDDLE_VERBOSE_TESTS')) {
  jest.spyOn(global.console, 'error').mockImplementation(() => jest.fn());
  jest.spyOn(global.console, 'info').mockImplementation(() => jest.fn());
  jest.spyOn(global.console, 'log').mockImplementation(() => jest.fn());
  jest.spyOn(global.console, 'warn').mockImplementation(() => jest.fn());
  jest.spyOn(global.console, 'debug').mockImplementation(() => jest.fn());
}
jest.mock('electron', () => require('./mocks/electron'));
jest.mock('fs-extra');
jest.mock('@electron/get');

expect.addSnapshotSerializer(createSerializer({ mode: 'deep' }));

// We want to detect jest sometimes
global.__JEST__ = global.__JEST__ || {};

// Setup for main tests
global.window = global.window || {};
global.document = global.document || { body: {} };
global.fetch = window.fetch = jest.fn();

delete window.localStorage;
window.localStorage = {};

/**
 * Mock these properties twice so that they're available
 * both at the top-level of files and also within the
 * code called in individual tests.
 */
window.ElectronFiddle = new ElectronFiddleMock();
window.localStorage.setItem = jest.fn();
window.localStorage.getItem = jest.fn();
window.localStorage.removeItem = jest.fn();

beforeEach(() => {
  process.env.JEST = true;
  process.env.TEST = true;
  document.body.innerHTML = '<div id="app" />';

  window.ElectronFiddle = new ElectronFiddleMock();
  window.localStorage.setItem.mockReset();
  window.localStorage.getItem.mockReset();
  window.localStorage.removeItem.mockReset();
});
