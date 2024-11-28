import '@testing-library/jest-dom';

import { configure as enzymeConfigure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import { createSerializer } from 'enzyme-to-json';
import { mocked } from 'jest-mock';
import { configure as mobxConfigure } from 'mobx';

import { AppMock, ElectronFiddleMock, MonacoMock } from './mocks/mocks';

enzymeConfigure({ adapter: new Adapter() });

// allow jest fns to overwrite readonly mobx stuff
// https://mobx.js.org/configuration.html#safedescriptors-boolean
mobxConfigure({ safeDescriptors: false });

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

class FakeBroadcastChannel extends EventTarget {
  public name: string;

  constructor(channelName: string) {
    super();
    this.name = channelName;
  }

  postMessage(message: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: message }));
  }
}

(global.BroadcastChannel as any) = class Singleton {
  static channels = new Map();

  constructor(channelName: string) {
    if (!Singleton.channels.has(channelName)) {
      Singleton.channels.set(
        channelName,
        new FakeBroadcastChannel(channelName),
      );
    }
    return Singleton.channels.get(channelName);
  }
};

expect.addSnapshotSerializer(createSerializer({ mode: 'deep' }) as any);

// We want to detect jest sometimes
(global as any).__JEST__ = (global as any).__JEST__ || {};

// Setup for main tests
global.window = global.window || {};
global.document = global.document || { body: {} };
global.fetch = window.fetch = jest.fn();

delete (window as any).localStorage;
(window.localStorage as any) = {};

window.navigator = window.navigator ?? {};
(window.navigator.clipboard as any) = {};

/**
 * Mock these properties twice so that they're available
 * both at the top-level of files and also within the
 * code called in individual tests.
 */
(window.ElectronFiddle as any) = new ElectronFiddleMock();
(window.app as any) = new AppMock();
(window.monaco as any) = new MonacoMock();
window.localStorage.setItem = jest.fn();
window.localStorage.getItem = jest.fn();
window.localStorage.removeItem = jest.fn();
window.open = jest.fn();
window.navigator.clipboard.readText = jest.fn();
window.navigator.clipboard.writeText = jest.fn();

beforeEach(() => {
  (process.env.JEST as any) = true;
  (process.env.TEST as any) = true;
  document.body.innerHTML = '<div id="app" />';

  (window.ElectronFiddle as any) = new ElectronFiddleMock();
  (window.app as any) = new AppMock();
  (window.monaco as any) = new MonacoMock();
  mocked(window.localStorage.setItem).mockReset();
  mocked(window.localStorage.getItem).mockReset();
  mocked(window.localStorage.removeItem).mockReset();
  mocked(window.open).mockReset();
  window.matchMedia = jest.fn((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
});
