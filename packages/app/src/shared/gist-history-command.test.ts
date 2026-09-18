import { describe, expect, it } from 'vitest';

import { isCommandEnabled } from './commands';
import { defaultSettings } from './settings';

describe('gist.history', () => {
  it('is enabled for a loaded gist only while "Show gist revision history" is on', () => {
    const app = (gistShowHistory: boolean) =>
      ({ settings: { ...defaultSettings, gistShowHistory } }) as never;
    const gistWindow = {
      fiddle: { source: { gistId: '8c5fc0c6a5153d49b5a4a56d3ed9da8f' } },
    } as never;
    expect(isCommandEnabled('gist.history', app(true), gistWindow)).toBe(true);
    expect(isCommandEnabled('gist.history', app(false), gistWindow)).toBe(false);
    expect(
      isCommandEnabled('gist.history', app(true), { fiddle: { source: {} } } as never),
    ).toBe(false);
  });
});
