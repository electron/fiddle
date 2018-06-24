export enum IpcEvents {
  MAIN_WINDOW_READY_TO_SHOW = 'MAIN_WINDOW_READY_TO_SHOW',
  OPEN_SETTINGS = 'OPEN_SETTINGS',
  LOAD_GIST_REQUEST = 'LOAD_GIST_REQUEST'
}

export const ipcMainEvents = [
  IpcEvents.MAIN_WINDOW_READY_TO_SHOW
];

export const ipcRendererEvents = [
  IpcEvents.OPEN_SETTINGS,
  IpcEvents.LOAD_GIST_REQUEST
];
