import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  app: { state: 'loading' } as unknown,
  win: { state: 'loading' } as unknown,
}));

vi.mock('../ipc/renderer', () => ({
  useAppStore: () => mocks.app,
  useWindowStore: () => mocks.win,
  documentsApi: {},
}));

import { StoreProvider, useAppState, useStoreError, useWindowState } from './state';

const seen: { settings: unknown[]; files: unknown[]; error: (Error | undefined)[] } = {
  settings: [],
  files: [],
  error: [],
};

function Probe() {
  seen.settings.push(useAppState()?.settings);
  seen.files.push(useWindowState()?.fiddle.files);
  seen.error.push(useStoreError());
  return null;
}

const app = (rev: number, installs: unknown) => ({
  state: 'ready',
  result: {
    rev,
    settings: { theme: 'lucent', channels: ['stable'] },
    versions: { installs },
  },
});
const win = (rev: number, files: string[]) => ({
  state: 'ready',
  result: { rev, fiddle: { files: files.map((name) => ({ name })) }, view: 'editor' },
});

afterEach(() => {
  seen.settings = [];
  seen.files = [];
  seen.error = [];
});

describe('StoreProvider', () => {
  it('keeps the identity of store parts that a push did not change', () => {
    mocks.app = app(1, {});
    mocks.win = win(1, ['main.js']);
    const view = render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    // A download progress push: new objects everywhere, same settings and files.
    mocks.app = app(2, { '43.0.0': { state: 'downloading', percent: 10 } });
    mocks.win = win(1, ['main.js']);
    view.rerender(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const settings = seen.settings.filter(Boolean);
    expect(settings.length).toBeGreaterThan(1);
    expect(new Set(settings).size).toBe(1);
    expect(new Set(seen.files.filter(Boolean)).size).toBe(1);
  });

  it('reports a store that failed to load', () => {
    const error = new Error('validation failed');
    mocks.app = { state: 'ready', result: app(1, {}).result };
    mocks.win = { state: 'error', error };
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(seen.error.at(-1)).toBe(error);
  });
});
