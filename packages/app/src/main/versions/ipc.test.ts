/** The Versions IPC handlers that do more than forward to a service. */
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

import { bindVersionsIpc } from './ipc';

const versions = {
  install: vi.fn(async () => '/electron'),
  downloadAll: vi.fn<(list: string[]) => Promise<void>>(),
  localBuild: vi.fn((id: string) => (id === 'b1' ? { id, path: '/build' } : undefined)),
  label: (ref: VersionRef) => (ref.kind === 'release' ? `v${ref.version}` : ref.id),
};
const types = {
  forRelease: vi.fn(async (version: string) => ({ source: 'release', version })),
  forLocal: vi.fn(async (build: { id: string }) => ({ source: 'local', id: build.id })),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fiddleVersion = { kind: 'release', version: '30.0.0' };
  bindVersionsIpc({
    contents: {},
    windowId: 'w',
    services: { versions, types, versionSelector: {} },
  } as never);
});

it("Download waits for the install but keeps the executable's path in main", async () => {
  await expect(mocks.handlers.Download!('30.0.0')).resolves.toBeUndefined();
  expect(versions.install).toHaveBeenCalledWith('30.0.0');
});

it('DownloadAll starts the downloads without making the renderer wait for them', () => {
  versions.downloadAll.mockReturnValue(new Promise(() => undefined));
  expect(mocks.handlers.DownloadAll!(['30.0.0'])).toBeUndefined();
  expect(versions.downloadAll).toHaveBeenCalledWith(['30.0.0']);
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
