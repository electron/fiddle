export enum IpcEvents {
  MAIN_WINDOW_READY_TO_SHOW = 'MAIN_WINDOW_READY_TO_SHOW',
  OPEN_SETTINGS = 'OPEN_SETTINGS'
}

export const ipcMainEvents = [
  IpcEvents.MAIN_WINDOW_READY_TO_SHOW
];

export const ipcRendererEvents = [
  IpcEvents.OPEN_SETTINGS
];
