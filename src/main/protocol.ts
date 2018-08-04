import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as nodeUrl from 'url';

import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';

const PROTOCOL = 'electron-fiddle';
const squirrelPath = path.resolve(path.dirname(process.execPath), '..', 'electron-fiddle.exe');

const handlePotentialProtocolLaunch = (url: string) => {
  if (!app.isReady()) {
    app.once('ready', () => handlePotentialProtocolLaunch(url));
    return;
  }
  const parsed = nodeUrl.parse(url.replace(/\/$/, ''));
  if (!parsed.pathname) return;
  const pathParts = parsed.pathname.split('/');
  if (pathParts.length <= 0 || pathParts.length > 2) return;

  ipcMainManager.send(IpcEvents.LOAD_GIST_REQUEST, [parsed.pathname]);
};

export const scanArgv = (argv: Array<string>) => {
  const protocolArg = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (protocolArg) {
    handlePotentialProtocolLaunch(protocolArg);
  }
};

export const listenForProtocolHandler = () => {
  const shouldQuit = app.makeSingleInstance(scanArgv);
  if (shouldQuit) return app.quit();

  app.on('open-url', (_, url) => {
    if (url.startsWith(`${PROTOCOL}://`)) {
      handlePotentialProtocolLaunch(url);
    }
  });

  if (process.platform === 'win32') {
    scanArgv(process.argv);
  }
};

export const setupProtocolHandler = () => {
  if (process.platform === 'win32' && !fs.existsSync(squirrelPath)) return;
  if (!app.isDefaultProtocolClient(PROTOCOL, squirrelPath)) {
    app.setAsDefaultProtocolClient(PROTOCOL, squirrelPath);
  }
};
