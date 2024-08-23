import { toJS } from 'mobx';

import { FiddleEvent } from '../src/interfaces';

const platform = process.platform;

export function overridePlatform(value: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value,
    writable: true,
  });
}

export function resetPlatform() {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
  });
}

const rendererOverrides = {
  arch: '',
  platform: '',
};

export function overrideRendererPlatform(value: NodeJS.Platform) {
  if (!rendererOverrides.platform) {
    rendererOverrides.platform = window.ElectronFiddle.platform;
  }

  Object.defineProperty(window.ElectronFiddle, 'platform', {
    value,
    writable: true,
  });
}

export function resetRendererPlatform() {
  Object.defineProperty(window.ElectronFiddle, 'platform', {
    value: rendererOverrides.platform,
    writable: true,
  });
}

export function overrideRendererArch(value: string) {
  if (!rendererOverrides.arch) {
    rendererOverrides.arch = window.ElectronFiddle.arch;
  }

  Object.defineProperty(window.ElectronFiddle, 'arch', {
    value,
    writable: true,
  });
}

export function resetRendererArch() {
  Object.defineProperty(window.ElectronFiddle, 'arch', {
    value: rendererOverrides.arch,
    writable: true,
  });
}

export class FetchMock {
  private readonly urls: Map<string, string> = new Map();
  public add(url: string, content: string) {
    this.urls.set(url, content);
  }
  constructor() {
    window.fetch = jest.fn().mockImplementation(async (url: string) => {
      const content = this.urls.get(url);
      if (!content) {
        console.trace('Unhandled mock URL:', url);
        return {
          ok: false,
        };
      }
      return {
        text: jest.fn().mockResolvedValue(content),
        json: jest.fn().mockImplementation(async () => JSON.parse(content)),
        ok: true,
      };
    });
  }
}

// return an object containing props in 'a' that are different from in 'b'
export function objectDifference(a: any, b: any): Record<string, unknown> {
  const serialize = (input: any) => JSON.stringify(toJS(input));

  const o: Record<string, unknown> = {};
  for (const entry of Object.entries(a)) {
    const key = entry[0];
    const val = toJS(entry[1]);
    if (serialize(val) == serialize(b[key])) continue;

    o[key] = key === 'editorMosaic' ? objectDifference(val, b[key]) : toJS(val);
  }
  return o;
}

interface WaitForOptions {
  /**
   * polling frequency, in msec
   * @defaultValue 100
   */
  interval: number;
  /**
   * timeout interval, in msec
   * @defaultValue 2000
   */
  timeout: number;
}

/**
 * Waits up to `timeout` msec for a test to pass.
 *
 * @param test - function to test
 * @returns a promise that returns the test result on success, or rejects on timeout
 */
export async function waitFor(
  test: () => any,
  options: WaitForOptions = {
    interval: 100,
    timeout: 2000,
  },
): Promise<any> {
  const { interval, timeout } = options;
  let elapsed = 0;
  return new Promise<void>((resolve, reject) => {
    (function check() {
      const result = test();
      if (result) {
        return resolve(result);
      }
      elapsed += interval;
      if (elapsed >= timeout) {
        return reject(`Timed out: ${timeout}ms`);
      }
      setTimeout(check, interval);
    })();
  });
}

export function emitEvent(type: FiddleEvent, ...args: any[]) {
  (window.ElectronFiddle.addEventListener as jest.Mock).mock.calls.forEach(
    (call) => {
      if (call[0] === type) {
        call[1](...args);
      }
    },
  );
}
