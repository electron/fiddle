import { EventEmitter } from 'node:events';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  setAsDefaultProtocolClient: vi.fn(),
  removeAsDefaultProtocolClient: vi.fn(),
  quit: vi.fn(),
}));

vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('../log');
vi.mock('electron', () => ({
  app: {
    setAsDefaultProtocolClient: mocks.setAsDefaultProtocolClient,
    removeAsDefaultProtocolClient: mocks.removeAsDefaultProtocolClient,
    quit: mocks.quit,
  },
}));

import {
  handleSquirrelStartup,
  PROTOCOL,
  squirrelEvent,
  squirrelStubPath,
} from './squirrel';
import { log } from '../log';

const realPlatform = process.platform;
const realArgv = process.argv;

describe('squirrelEvent', () => {
  it.each(['install', 'updated', 'uninstall', 'obsolete'])(
    'reads --squirrel-%s',
    (event) => {
      expect(squirrelEvent(['app.exe', `--squirrel-${event}`, '1.0.0'])).toBe(event);
    },
  );

  it('ignores everything else, including the flag in another position or with a suffix', () => {
    expect(squirrelEvent(['app.exe'])).toBeUndefined();
    expect(squirrelEvent(['app.exe', '--squirrel-firstrun'])).toBeUndefined();
    expect(squirrelEvent(['app.exe', '--squirrel-install-x'])).toBeUndefined();
    expect(squirrelEvent(['app.exe', 'file.js', '--squirrel-install'])).toBeUndefined();
  });
});

describe('handleSquirrelStartup', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.spawn.mockImplementation(() => {
      const child = new EventEmitter();
      setImmediate(() => child.emit('close'));
      return child;
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
    process.argv = realArgv;
  });

  function launch(platform: NodeJS.Platform, event?: string): boolean {
    Object.defineProperty(process, 'platform', { value: platform });
    process.argv = event ? ['app.exe', `--squirrel-${event}`] : ['app.exe'];
    return handleSquirrelStartup();
  }

  it('does nothing outside Windows, so a portable copy never touches shortcuts or the protocol', () => {
    expect(launch('linux', 'install')).toBe(false);
    expect(launch('darwin', 'uninstall')).toBe(false);
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.setAsDefaultProtocolClient).not.toHaveBeenCalled();
    expect(mocks.quit).not.toHaveBeenCalled();
  });

  it.each(['install', 'updated'])(
    'registers the protocol for the stub and creates the shortcut on %s, then quits',
    async (event) => {
      expect(launch('win32', event)).toBe(true);
      expect(mocks.setAsDefaultProtocolClient).toHaveBeenCalledWith(
        PROTOCOL,
        squirrelStubPath(),
      );
      expect(mocks.spawn).toHaveBeenCalledWith(
        expect.stringContaining('Update.exe'),
        [`--createShortcut=${path.basename(process.execPath)}`],
        expect.anything(),
      );
      await vi.waitFor(() => expect(mocks.quit).toHaveBeenCalledOnce());
    },
  );

  it('removes the protocol and the shortcut on uninstall, then quits', async () => {
    expect(launch('win32', 'uninstall')).toBe(true);
    expect(mocks.removeAsDefaultProtocolClient).toHaveBeenCalledWith(
      PROTOCOL,
      squirrelStubPath(),
    );
    expect(mocks.spawn.mock.calls[0]![1]).toEqual([
      `--removeShortcut=${path.basename(process.execPath)}`,
    ]);
    await vi.waitFor(() => expect(mocks.quit).toHaveBeenCalledOnce());
  });

  it('only quits on obsolete', async () => {
    expect(launch('win32', 'obsolete')).toBe(true);
    await vi.waitFor(() => expect(mocks.quit).toHaveBeenCalledOnce());
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.setAsDefaultProtocolClient).not.toHaveBeenCalled();
    expect(mocks.removeAsDefaultProtocolClient).not.toHaveBeenCalled();
  });

  it('still quits when Update.exe cannot be started', async () => {
    mocks.spawn.mockImplementation(() => {
      const child = new EventEmitter();
      setImmediate(() => child.emit('error', new Error('ENOENT')));
      return child;
    });
    launch('win32', 'install');
    await vi.waitFor(() => expect(mocks.quit).toHaveBeenCalledOnce());
    expect(log.warn).toHaveBeenCalledWith(
      'Update.exe failed',
      expect.any(Array),
      expect.any(Error),
    );
  });
});
