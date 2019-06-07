import { app } from 'electron';
import * as fs from 'fs';

import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';
import { listenForProtocolHandler, setupProtocolHandler } from '../../src/main/protocol';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('fs');

describe('protocol', () => {
  const oldArgv = [ ...process.argv ];

  beforeEach(() => {
    ipcMainManager.removeAllListeners();
    ipcMainManager.send = jest.fn();
    (app.isReady as any).mockReturnValue(true);
  });

  afterEach(() => {
    resetPlatform();

    process.argv = oldArgv;
  });

  describe('setupProtocolHandler()', () => {
    it('attempts to setup the protocol handler', () => {
      overridePlatform('win32');

      (fs.existsSync as any).mockReturnValue(true);
      setupProtocolHandler();
      expect(app.setAsDefaultProtocolClient).toHaveBeenCalled();
    });
  });

  describe('listenForProtocolHandler()', () => {
    it('handles a Fiddle url (open-url)', () => {
      overridePlatform('darwin');

      listenForProtocolHandler();

      const handler = (app.on as any).mock.calls[0][1];

      handler({}, 'electron-fiddle://gist/hi');
      expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.LOAD_GIST_REQUEST, [{ id: 'hi' }]);
    });

    it('handles a Fiddle url with a username (open-url)', () => {
      overridePlatform('darwin');

      listenForProtocolHandler();

      const handler = (app.on as any).mock.calls[0][1];

      handler({}, 'electron-fiddle://gist/username/gistID');
      expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.LOAD_GIST_REQUEST, [{ id: 'gistID' }]);
    });

    it('handles a non-fiddle url (open-url)', () => {
      overridePlatform('darwin');

      listenForProtocolHandler();

      const handler = (app.on as any).mock.calls[0][1];

      handler({}, 'electron-fiddle://noop');
      handler({}, 'electron-fiddle://gist/noop/noop/null');
      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
    });

    it('handles a Fiddle url (argv)', () => {
      overridePlatform('win32');

      process.argv = ['electron-fiddle://gist/hi-arg'];

      listenForProtocolHandler();

      expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.LOAD_GIST_REQUEST, [{ id: 'hi-arg' }]);
    });

    it('waits for the app to be ready', () => {
      overridePlatform('darwin');
      (app.isReady as any).mockReturnValue(false);

      listenForProtocolHandler();

      const handler = (app.on as any).mock.calls[0][1];
      handler({}, 'electron-fiddle://gist/hi-ready');

      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
      expect(app.once).toHaveBeenCalled();

      const cb = (app.once as jest.Mock).mock.calls[0][1];
      (app.isReady as any).mockReturnValue(true);

      cb();

      expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.LOAD_GIST_REQUEST, [{ id: 'hi-ready' }]);
    });

    it('handles an electron path url', () => {
      // electron-fiddle://electron/{ref}/{path}
      listenForProtocolHandler();

      const handler = (app.on as any).mock.calls[0][1];

      handler({}, 'electron-fiddle://electron/4.0.0/test/path');

      expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST, [
        {
          ref: '4.0.0',
          path: 'test/path'
        }
      ]);
    });

    it('handles a flawed electron path url', () => {
      listenForProtocolHandler();

      const handler = (app.on as any).mock.calls[0][1];
      handler({}, 'electron-fiddle://electron/4.0.0');

      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
    });

    it('handles a flawed url (unclear instruction)', () => {
      listenForProtocolHandler();

      const handler = (app.on as any).mock.calls[0][1];
      handler({}, 'electron-fiddle://noop/123');

      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
    });

    it('handles a flawed url (no instruction)', () => {
      listenForProtocolHandler();

      const handler = (app.on as any).mock.calls[0][1];
      handler({}, 'electron-fiddle://');

      expect(ipcMainManager.send).toHaveBeenCalledTimes(0);
    });
  });
});
