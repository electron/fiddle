/** The Versions IPC handlers, bound to fake services, and the window-version check they install. */
import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VersionRef } from '../../fiddle/fiddle';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => unknown>,
  writeText: vi.fn<(text: string) => void>(),
  fiddleVersion: { kind: 'release', version: '30.0.0' } as VersionRef,
}));

vi.mock('electron', () => ({ clipboard: { writeText: mocks.writeText } }));
vi.mock('../../ipc/main', () => ({
  Versions: {},
  implement: (_iface: unknown, _contents: unknown, handlers: typeof mocks.handlers) => {
    mocks.handlers = handlers;
  },
}));
vi.mock('../documents/service', () => ({
  getFiddle: () => ({ version: mocks.fiddleVersion }),
}));
vi.mock('../i18n', () => ({
  tm: () => (key: string, options?: Record<string, string>) =>
    options ? `${key}:${Object.values(options).join(',')}` : key,
}));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { bindVersionsIpc } from './ipc';

type Change = { store: 'app' } | { store: 'window'; windowId: string };

interface FakeWindow {
  rev: number;
  versionNotice: { id: string } | null;
  fiddle: { versionRef: VersionRef };
}

const windows = new Map<string, FakeWindow>();
const listeners = new Set<(change: Change) => void>();
const hub = {
  getWindow: (id: string) => windows.get(id),
  updateWindow: vi.fn((id: string, patch: Partial<FakeWindow>) => {
    Object.assign(windows.get(id)!, patch);
    return 1;
  }),
  onChange: (listener: (change: Change) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
const emit = (change: Change) => listeners.forEach((listener) => listener(change));

const versions = {
  release: vi.fn((version: string) => (version === '30.0.0' ? { version } : undefined)),
  install: vi.fn<(version: string) => Promise<void>>(),
  downloadAll: vi.fn<(list: string[]) => Promise<void>>(),
  addLocalBuild: vi.fn<(windowId: string) => Promise<string | undefined>>(),
  localBuild: vi.fn((id: string) => (id === 'b1' ? { id, path: '/build' } : undefined)),
  label: (ref: VersionRef) => (ref.kind === 'release' ? `v${ref.version}` : ref.id),
};
const types = {
  forRelease: vi.fn(async (version: string) => ({ source: 'release', version })),
  forLocal: vi.fn(async (build: { id: string }) => ({ source: 'local', id: build.id })),
};
const selector = {
  select: vi.fn<(windowId: string, ref: VersionRef) => Promise<number | undefined>>(),
  validate: vi.fn(async () => undefined),
  retry: vi.fn(),
};
let contents: EventEmitter;

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  windows.clear();
  windows.set('w', {
    rev: 4,
    versionNotice: null,
    fiddle: { versionRef: { kind: 'release', version: '30.0.0' } },
  });
  mocks.fiddleVersion = { kind: 'release', version: '30.0.0' };
  contents = new EventEmitter();
  bindVersionsIpc({
    contents,
    windowId: 'w',
    services: { hub, versions, types, versionSelector: selector },
  } as never);
});

describe('Download', () => {
  it('rejects a version the release list does not know with notFound, before installing', async () => {
    await expect(mocks.handlers.Download!('99.0.0')).rejects.toMatchObject({
      code: 'not-found',
    });
    expect(versions.install).not.toHaveBeenCalled();
  });

  it('wraps an installer failure in a network FiddleError that names the version', async () => {
    versions.install.mockRejectedValue(new Error('ECONNRESET'));
    await expect(mocks.handlers.Download!('30.0.0')).rejects.toMatchObject({
      code: 'network',
      message: 'downloadFailed:30.0.0,ECONNRESET',
    });
  });

  it('resolves once the installer is done', async () => {
    versions.install.mockResolvedValue();
    await expect(mocks.handlers.Download!('30.0.0')).resolves.toBeUndefined();
  });
});

it('DownloadAll starts the downloads without making the renderer wait for them', () => {
  versions.downloadAll.mockReturnValue(new Promise(() => undefined));
  expect(mocks.handlers.DownloadAll!(['30.0.0'])).toBeUndefined();
  expect(versions.downloadAll).toHaveBeenCalledWith(['30.0.0']);
});

describe('SetVersion', () => {
  it('returns the rev from the selector, remembering the choice', async () => {
    selector.select.mockResolvedValue(9);
    const ref: VersionRef = { kind: 'release', version: '30.0.0' };
    expect(await mocks.handlers.SetVersion!(ref)).toBe(9);
    expect(selector.select).toHaveBeenCalledWith('w', ref, { remember: true });
  });

  it("falls back to the window's rev when nothing changed, and to 0 for a gone window", async () => {
    selector.select.mockResolvedValue(undefined);
    expect(await mocks.handlers.SetVersion!({ kind: 'release', version: '30.0.0' })).toBe(
      4,
    );
    windows.delete('w');
    expect(await mocks.handlers.SetVersion!({ kind: 'release', version: '30.0.0' })).toBe(
      0,
    );
  });
});

describe('AddLocalBuild', () => {
  it('selects the new build and reports true when one was added', async () => {
    versions.addLocalBuild.mockResolvedValue('b1');
    expect(await mocks.handlers.AddLocalBuild!()).toBe(true);
    expect(selector.select).toHaveBeenCalledWith(
      'w',
      { kind: 'local', id: 'b1' },
      { remember: true },
    );
  });

  it('reports false and selects nothing when the picker added no build', async () => {
    versions.addLocalBuild.mockResolvedValue(undefined);
    expect(await mocks.handlers.AddLocalBuild!()).toBe(false);
    expect(selector.select).not.toHaveBeenCalled();
  });
});

describe('GetTypes', () => {
  it("loads the release's types for a release version", async () => {
    expect(await mocks.handlers.GetTypes!()).toEqual({
      source: 'release',
      version: '30.0.0',
    });
    expect(types.forLocal).not.toHaveBeenCalled();
  });

  it("loads a local build's types, or null when the build is no longer registered", async () => {
    mocks.fiddleVersion = { kind: 'local', id: 'b1' };
    expect(await mocks.handlers.GetTypes!()).toEqual({ source: 'local', id: 'b1' });
    expect(types.forLocal).toHaveBeenCalledWith({ id: 'b1', path: '/build' });

    mocks.fiddleVersion = { kind: 'local', id: 'gone' };
    expect(await mocks.handlers.GetTypes!()).toBeNull();
    expect(types.forRelease).not.toHaveBeenCalled();
  });
});

it("CopyVersion puts the fiddle version's label on the clipboard", () => {
  mocks.handlers.CopyVersion!();
  expect(mocks.writeText).toHaveBeenCalledWith('v30.0.0');
});

it('RetryDownload retries for this window', () => {
  mocks.handlers.RetryDownload!();
  expect(selector.retry).toHaveBeenCalledWith('w');
});

describe('DismissNotice', () => {
  it('clears the notice the renderer names, and leaves a newer one alone', () => {
    windows.get('w')!.versionNotice = { id: 'n2' };
    mocks.handlers.DismissNotice!('n1');
    expect(hub.updateWindow).not.toHaveBeenCalled();

    mocks.handlers.DismissNotice!('n2');
    expect(hub.updateWindow).toHaveBeenCalledWith('w', { versionNotice: null });
  });
});

describe('the window version check', () => {
  it("validates the window's version once per distinct version, ignoring other stores and windows", () => {
    emit({ store: 'app' });
    emit({ store: 'window', windowId: 'other' });
    expect(selector.validate).not.toHaveBeenCalled();

    emit({ store: 'window', windowId: 'w' });
    emit({ store: 'window', windowId: 'w' });
    expect(selector.validate).toHaveBeenCalledOnce();
    expect(selector.validate).toHaveBeenCalledWith('w');

    windows.get('w')!.fiddle.versionRef = { kind: 'local', id: 'b1' };
    emit({ store: 'window', windowId: 'w' });
    expect(selector.validate).toHaveBeenCalledTimes(2);
  });

  it('skips a window the hub no longer has', () => {
    windows.delete('w');
    emit({ store: 'window', windowId: 'w' });
    expect(selector.validate).not.toHaveBeenCalled();
  });

  it('logs a failed check instead of leaving the rejection unhandled', async () => {
    const { log } = await import('../log');
    selector.validate.mockRejectedValueOnce(new Error('offline'));
    emit({ store: 'window', windowId: 'w' });
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalled());
  });

  it('stops listening when the web contents are destroyed', () => {
    contents.emit('destroyed');
    expect(listeners.size).toBe(0);
    emit({ store: 'window', windowId: 'w' });
    expect(selector.validate).not.toHaveBeenCalled();
  });
});
