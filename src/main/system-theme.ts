import { nativeTheme } from 'electron';
import { ipcMainManager } from './ipc';
import { IpcEvents } from '../ipc-events';

export function setupSystemTheme() {
  maybeUpdateTheme();

  nativeTheme.on('updated', () => {
    maybeUpdateTheme();
  });

  ipcMainManager.on(IpcEvents.SET_THEME_SOURCE, (_event, source) => {
    nativeTheme.themeSource = source;
  });
}

export function maybeUpdateTheme() {
  if (nativeTheme.themeSource === 'system') {
    ipcMainManager.send(IpcEvents.SET_SYSTEM_THEME, [
      nativeTheme.shouldUseDarkColors,
    ]);
  }
}
