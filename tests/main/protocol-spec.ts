/**
 * @jest-environment node
 */

import * as fs from 'node:fs';

import { app } from 'electron';
import { mocked } from 'jest-mock';

import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';
import {
  listenForProtocolHandler,
  setupProtocolHandler,
} from '../../src/main/protocol';
import { getOrCreateMainWindow, mainIsReady } from '../../src/main/windows';
import { overridePlatform, resetPlatform } from '../utils';

type OpenUrlCallback = (event: object, url: string) => void;
type SecondInstanceCallback = (event: object, argv: string[]) => void;

jest.mock('node:fs');

describe('protocol', () => {
  const oldArgv = [...process.argv];

  beforeEach(() => {
    ipcMainManager.removeAllListeners();
    ipcMainManager.send = jest.fn();
    mocked(app.isReady).mockReturnValue(true);
  });

  afterEach(() => {
    resetPlatform();

    process.argv = oldArgv;
  });

  describe('setupProtocolHandler()', () => {
    it('attempts to setup the protocol handler', () => {
      overridePlatform('win32');

      mocked(fs.existsSync).mockReturnValue(true);
      setupProtocolHandler();
      expect(app.setAsDefaultProtocolClient).toHaveBeenCalled();
    });
  });

  describe('listenForProtocolHandler()', () => {
    it('handles a Fiddle url (second-instance)', () => {
      overridePlatform('win32');

      listenForProtocolHandler();

      const handler: SecondInstanceCallback = mocked(app.on).mock.calls[1][1];

      handler({}, ['electron-fiddle://gist/hi']);
      expect(ipcMainManager.send).toHaveBeenCalledWith(
        IpcEvents.LOAD_GIST_REQUEST,
        [{ id: 'hi' }],
      );
    });

    it('handles a Fiddle url (open-url)', () => {
      overridePlatform('darwin');

      listenForProtocolHandler();

      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];

      handler({}, 'electron-fiddle://gist/hi');
      expect(ipcMainManager.send).toHaveBeenCalledWith(
        IpcEvents.LOAD_GIST_REQUEST,
        [{ id: 'hi' }],
      );
    });

    it('handles a Fiddle url with a username (open-url)', () => {
      overridePlatform('darwin');

      listenForProtocolHandler();

      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];

      handler({}, 'electron-fiddle://gist/username/gistID');
      expect(ipcMainManager.send).toHaveBeenCalledWith(
        IpcEvents.LOAD_GIST_REQUEST,
        [{ id: 'gistID' }],
      );
    });

    it('handles a non-fiddle url (open-url)', () => {
      overridePlatform('darwin');

      listenForProtocolHandler();

      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];

      handler({}, 'electron-fiddle://noop');
      handler({}, 'electron-fiddle://gist/noop/noop/null');
      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
    });

    it('handles a Fiddle url (argv)', () => {
      overridePlatform('win32');

      process.argv = ['electron-fiddle://gist/hi-arg'];

      listenForProtocolHandler();

      expect(ipcMainManager.send).toHaveBeenCalledWith(
        IpcEvents.LOAD_GIST_REQUEST,
        [{ id: 'hi-arg' }],
      );
    });

    it('waits for the app to be ready', () => {
      overridePlatform('darwin');
      mocked(app.isReady).mockReturnValue(false);

      listenForProtocolHandler();

      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];
      handler({}, 'electron-fiddle://gist/hi-ready');

      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
      expect(app.once).toHaveBeenCalled();

      const cb = mocked(app.once).mock.calls[0][1];
      mocked(app.isReady).mockReturnValue(true);

      cb();

      expect(ipcMainManager.send).toHaveBeenCalledWith(
        IpcEvents.LOAD_GIST_REQUEST,
        [{ id: 'hi-ready' }],
      );
    });

    it('handles an electron path url', () => {
      // electron-fiddle://electron/{tag}/{path}
      listenForProtocolHandler();

      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];

      handler({}, 'electron-fiddle://electron/v4.0.0/test/path');

      expect(ipcMainManager.send).toHaveBeenCalledWith(
        IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST,
        [
          {
            tag: 'v4.0.0',
            path: 'test/path',
          },
        ],
      );
    });

    it('handles a flawed electron path url', () => {
      listenForProtocolHandler();

      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];
      handler({}, 'electron-fiddle://electron/v4.0.0');

      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
    });

    it('handles a flawed url (unclear instruction)', () => {
      listenForProtocolHandler();

      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];
      handler({}, 'electron-fiddle://noop/123');

      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
    });

    it('handles a flawed url (no instruction)', () => {
      listenForProtocolHandler();

      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];
      handler({}, 'electron-fiddle://');

      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
    });

    it('focuses window when loading a fiddle', async () => {
      mainIsReady();
      listenForProtocolHandler();

      const mainWindow = await getOrCreateMainWindow();
      const handler: OpenUrlCallback = mocked(app.on).mock.calls[0][1];

      handler({}, 'electron-fiddle://electron/v4.0.0/test/path');

      await new Promise(process.nextTick);
      expect(mainWindow.focus).toHaveBeenCalled();
    });
  });
});
