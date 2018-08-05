const { configure } = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
const { ElectronFiddleMock } = require('./mocks/electron-fiddle');

configure({ adapter: new Adapter() });

global.confirm = jest.fn();
global.fetch = require('jest-fetch-mock');

jest.spyOn(global.console, 'log').mockImplementation(() => jest.fn());
jest.spyOn(global.console, 'warn').mockImplementation(() => jest.fn());
jest.mock('electron', () => require('./mocks/electron'));

// We'll do this twice.
window.localStorage = {};
window.localStorage.setItem = jest.fn();
window.localStorage.getItem = jest.fn();


beforeEach(() => {
  global.ElectronFiddle = new ElectronFiddleMock();
  process.env.JEST = true;
  process.env.TEST = true;

  window.localStorage.setItem.mockReset();
  window.localStorage.getItem.mockReset();
});
