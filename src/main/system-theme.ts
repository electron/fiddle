import { nativeTheme } from 'electron';
import { ipcMainManager } from './ipc';
import { IpcEvents } from '../ipc-events';

export function setupSystemTheme() {
  ipcMainManager.send(IpcEvents.ERICK, [
    nativeTheme.shouldUseDarkColors,
    nativeTheme.themeSource === 'system',
  ]);

  nativeTheme.on('updated', () => {
    ipcMainManager.send(IpcEvents.ERICK, [
      nativeTheme.shouldUseDarkColors,
      nativeTheme.themeSource === 'system',
    ]);
  });

  ipcMainManager.on(IpcEvents.ERICK, (_event, [source]) => {
    nativeTheme.themeSource = source;
  });
}
