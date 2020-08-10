import { nativeTheme } from 'electron';
import { defaultDark, defaultLight } from '../renderer/themes-defaults';
import { ipcMainManager } from './ipc';
import { IpcEvents } from '../ipc-events';

export function setupSystemTheme() {
  nativeTheme.on('updated', () => {
    ipcMainManager.send(IpcEvents.ERICK, [nativeTheme.shouldUseDarkColors]);
  });

  ipcMainManager.on(IpcEvents.ERICK, (_event, [source]) => {
    nativeTheme.themeSource = source;
  });
}
