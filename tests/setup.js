const { configure } = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
const { ElectronFiddleMock } = require('./mocks/electron-fiddle');

configure({ adapter: new Adapter() });

global.confirm = jest.fn();
global.fetch = require('jest-fetch-mock');

jest.spyOn(global.console, 'log').mockImplementation(() => jest.fn());
jest.spyOn(global.console, 'warn').mockImplementation(() => jest.fn());

require('jest-localstorage-mock');

beforeEach(() => {
  global.ElectronFiddle = new ElectronFiddleMock();
})
