import { Module } from 'node:module';

import { toJS } from 'mobx';
import { type Mock, vi } from 'vitest';

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
    window.fetch = vi.fn().mockImplementation(async (url: string) => {
      const content = this.urls.get(url);
      if (!content) {
        console.trace('Unhandled mock URL:', url);
        return {
          ok: false,
        };
      }
      return {
        text: vi.fn().mockResolvedValue(content),
        json: vi.fn().mockImplementation(async () => JSON.parse(content)),
        ok: true,
      };
    });
  }
}

// return an object containing props in 'a' that are different from in 'b'
export function objectDifference(a: any, b: any): Record<string, unknown> {
  const serialize = (input: any) =>
    JSON.stringify(toJS(input), (_key, value) => {
      if (value?.constructor.name === 'Timeout') {
        return value[Symbol.toPrimitive]();
      }
      return value;
    });

  const o: Record<string, unknown> = {};
  for (const entry of Object.entries(a)) {
    const key = entry[0];
    const val = toJS(entry[1]);
    if (serialize(val) == serialize(b[key])) continue;

    o[key] = key === 'editorMosaic' ? objectDifference(val, b[key]) : toJS(val);
  }
  return o;
}

export function emitEvent(type: FiddleEvent, ...args: any[]) {
  (window.ElectronFiddle.addEventListener as Mock).mock.calls.forEach(
    (call) => {
      if (call[0] === type) {
        call[1](...args);
      }
    },
  );
}

/**
 * Helper function to mock CommonJS `require` calls with Vitest.
 *
 * @see https://github.com/vitest-dev/vitest/discussions/3134
 * @param mockedUri - mocked module URI
 * @param stub - stub function to assign to mock
 */
export async function mockRequire(mockedUri: string, stub: any) {
  //@ts-expect-error undocumented functions
  Module._load_original = Module._load;
  //@ts-expect-error undocumented functions
  Module._load = (uri, parent) => {
    if (uri === mockedUri) return stub;
    //@ts-expect-error undocumented functions
    return Module._load_original(uri, parent);
  };
}
