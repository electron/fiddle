const { configure } = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
const { ElectronFiddleMock } = require('./mocks/electron-fiddle');
const { createSerializer } = require('enzyme-to-json');

configure({ adapter: new Adapter() });
expect.addSnapshotSerializer(createSerializer({mode: 'deep'}));

global.confirm = jest.fn();
global.fetch = require('jest-fetch-mock');

jest.spyOn(global.console, 'log').mockImplementation(() => jest.fn());
jest.spyOn(global.console, 'warn').mockImplementation(() => jest.fn());
jest.mock('electron', () => require('./mocks/electron'));
jest.mock('fs-extra');
jest.mock('electron-download');

delete window.localStorage;
// We'll do this twice.
window.localStorage = {};
window.localStorage.setItem = jest.fn();
window.localStorage.getItem = jest.fn();
window.localStorage.removeItem = jest.fn();

beforeEach(() => {
  document.body.innerHTML = '<div id="app" />';

  global.ElectronFiddle = new ElectronFiddleMock();
  process.env.JEST = true;
  process.env.TEST = true;

  window.localStorage.setItem.mockReset();
  window.localStorage.getItem.mockReset();
  window.localStorage.removeItem.mockReset();
});
