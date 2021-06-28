import { toJS } from 'mobx';

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

export function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

export function mockFetchOnce(text: string) {
  (window.fetch as jest.Mock).mockImplementationOnce(() => {
    return Promise.resolve({
      text: jest.fn().mockResolvedValue(text),
      json: jest.fn().mockResolvedValue(JSON.parse(text)),
    });
  });
}

export class FetchMock {
  private readonly urls: Map<string, string> = new Map();
  public add(url: string, content: string) {
    this.urls.set(url, content);
  }
  constructor() {
    window.fetch = jest.fn().mockImplementation((url: string) => {
      const content = this.urls.get(url);
      if (!content) {
        console.trace('Unhandled mock URL:', url);
        return {
          ok: false,
        };
      }
      return Promise.resolve({
        text: jest.fn().mockImplementation(() => Promise.resolve(content)),
        json: jest
          .fn()
          .mockImplementation(() => Promise.resolve(JSON.parse(content))),
        ok: true,
      });
    });
  }
}

// return an object containing props in 'a' that are different from in 'b'
export function objectDifference<Type>(a: Type, b: Type): Type {
  const serialize = (input: any) => JSON.stringify(toJS(input));

  const o = {};
  for (const entry of Object.entries(a)) {
    const key = entry[0];
    const val = toJS(entry[1]);
    if (serialize(val) == serialize(b[key])) continue;

    o[key] = key === 'editorMosaic' ? objectDifference(val, b[key]) : toJS(val);
  }
  return o as Type;
}

/**
 * Waits up to `timeout` msec for a test to pass.
 *
 * @return a promise that returns the test result on success, or rejects on timeout
 * @param {() => any} test - function to test
 * @param {Object} options
 * @param {Number} [options.interval=100] - polling frequency, in msec
 * @param {Number} [options.timeout=2000] - timeout interval, in msec
 */
export async function waitFor(
  test: () => any,
  options = {
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
