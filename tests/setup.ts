import { configure as enzymeConfigure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import { createSerializer } from 'enzyme-to-json';
import { mocked } from 'jest-mock';
import { configure as mobxConfigure } from 'mobx';

import { ElectronFiddleMock } from './mocks/mocks';
import { getOrCreateMapValue } from './utils';

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

type MockLock = Lock & {
  abortController: AbortController;
};

class FakeNavigatorLocks implements LockManager {
  locks = {
    held: new Map<string, Map<LockMode, Set<MockLock>>>(),
  };

  query = async () => {
    const result = {
      held: [...this.locks.held.values()].reduce((acc, item) => {
        acc.push(...[...item.get('exclusive')!.values()]);
        acc.push(...[...item.get('shared')!.values()]);

        return acc;
      }, [] as MockLock[]),
    };

    return result as LockManagerSnapshot;
  };

  request = (async (...args: Parameters<LockManager['request']>) => {
    const [
      name,
      options = {
        ifAvailable: false,
        mode: 'exclusive',
        steal: false,
      },
      cb,
    ] = args;

    const { ifAvailable, mode, steal } = options;

    const lock = {
      name,
      mode,
      abortController: new AbortController(),
    } as MockLock;

    const heldLocksWithSameName = getOrCreateMapValue(
      this.locks.held,
      name,
      new Map<LockMode, Set<MockLock>>(),
    );

    const exclusiveLocksWithSameName = getOrCreateMapValue(
      heldLocksWithSameName,
      'exclusive',
      new Set<MockLock>(),
    );

    const sharedLocksWithSameName = getOrCreateMapValue(
      heldLocksWithSameName,
      'shared',
      new Set<MockLock>(),
    );

    if (mode === 'shared') {
      sharedLocksWithSameName.add(lock);

      try {
        await cb(lock);
      } finally {
        sharedLocksWithSameName.delete(lock);
      }

      return;
    }

    // exclusive lock

    // no locks with this name -> grant an exclusive lock
    if (
      exclusiveLocksWithSameName.size === 0 &&
      sharedLocksWithSameName.size === 0
    ) {
      exclusiveLocksWithSameName.add(lock);

      try {
        await cb(lock);
      } finally {
        exclusiveLocksWithSameName.delete(lock);
      }

      return;
    }

    // steal any currently held locks
    if (steal) {
      for (const lock of sharedLocksWithSameName) {
        lock.abortController.abort();
      }

      for (const lock of exclusiveLocksWithSameName) {
        lock.abortController.abort();
      }

      sharedLocksWithSameName.clear();
      exclusiveLocksWithSameName.clear();

      exclusiveLocksWithSameName.add(lock);

      try {
        await cb(lock);
      } finally {
        exclusiveLocksWithSameName.delete(lock);
      }

      return;
    }

    // run the callback without waiting for the lock to be released
    if (ifAvailable) {
      // just run the callback without waiting for it
      cb(null);

      return;
    }

    // @TODO add the lock to the list of pending locks?

    // it's an exclusive lock, so there's only one value
    const currentLock = exclusiveLocksWithSameName.values().next()
      .value as MockLock;

    const { abortController: currentLockAbortController } = currentLock;

    // wait for the current lock to be released
    await new Promise<void>((resolve, reject) => {
      currentLockAbortController.signal.onabort = () => resolve();

      const { abortController: pendingLockAbortController } = lock;

      // this allows the locking mechanism to release this lock
      pendingLockAbortController.signal.onabort = () => reject();
    });

    // clear the exclusive locks
    exclusiveLocksWithSameName.clear();

    // grant our lock
    exclusiveLocksWithSameName.add(lock);

    try {
      // run the callback
      await cb(lock);
    } finally {
      exclusiveLocksWithSameName.delete(lock);
    }

    return;
  }) as LockManager['request'];
}

(window.navigator.locks as any) = new FakeNavigatorLocks();

/**
 * Mock these properties twice so that they're available
 * both at the top-level of files and also within the
 * code called in individual tests.
 */
(window.ElectronFiddle as any) = new ElectronFiddleMock();
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
  mocked(window.localStorage.setItem).mockReset();
  mocked(window.localStorage.getItem).mockReset();
  mocked(window.localStorage.removeItem).mockReset();
  mocked(window.open).mockReset();
});
