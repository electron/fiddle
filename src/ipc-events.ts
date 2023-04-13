export enum IpcEvents {
  OPEN_SETTINGS = 'OPEN_SETTINGS',
  LOAD_GIST_REQUEST = 'LOAD_GIST_REQUEST',
  LOAD_ELECTRON_EXAMPLE_REQUEST = 'LOAD_ELECTRON_EXAMPLE_REQUEST',
  FIDDLE_RUN = 'FIDDLE_RUN',
  FIDDLE_PACKAGE = 'FIDDLE_PACKAGE',
  FIDDLE_MAKE = 'FIDDLE_MAKE',
  MONACO_EXECUTE_COMMAND = 'MONACO_EXECUTE_COMMAND',
  MONACO_TOGGLE_OPTION = 'MONACO_TOGGLE_OPTION',
  FS_NEW_FIDDLE = 'FS_NEW_FIDDLE',
  FS_NEW_TEST = 'FS_NEW_TEST',
  FS_OPEN_FIDDLE = 'FS_OPEN_FIDDLE',
  FS_OPEN_TEMPLATE = 'FS_OPEN_TEMPLATE',
  FS_SAVE_FIDDLE = 'FS_SAVE_FIDDLE',
  FS_SAVE_FIDDLE_GIST = 'FS_SAVE_FIDDLE_GIST',
  FS_SAVE_FIDDLE_FORGE = 'FS_SAVE_FIDDLE_FORGE',
  FS_SAVE_FIDDLE_DIALOG = 'FS_SAVE_FIDDLE_DIALOG',
  FS_SAVE_FIDDLE_ERROR = 'FS_SAVE_FIDDLE_ERROR',
  SHOW_WARNING_DIALOG = 'SHOW_WARNING_DIALOG',
  SHOW_WELCOME_TOUR = 'SHOW_WELCOME_TOUR',
  CLEAR_CONSOLE = 'CLEAR_CONSOLE',
  LOAD_LOCAL_VERSION_FOLDER = 'LOAD_LOCAL_VERSION_FOLDER',
  SHOW_LOCAL_VERSION_FOLDER_DIALOG = 'SHOW_LOCAL_VERSION_FOLDER_DIALOG',
  BISECT_COMMANDS_TOGGLE = 'BISECT_COMMANDS_TOGGLE',
  BEFORE_QUIT = 'BEFORE_QUIT',
  CONFIRM_QUIT = 'CONFIRM_QUIT',
  GET_APP_PATHS = 'GET_APP_PATHS',
  SELECT_ALL_IN_EDITOR = 'SELECT_ALL_IN_EDITOR',
  UNDO_IN_EDITOR = 'UNDO_IN_EDITOR',
  REDO_IN_EDITOR = 'REDO_IN_EDITOR',
  BLOCK_ACCELERATORS = 'BLOCK_ACCELERATORS',
  SET_SHOW_ME_TEMPLATE = 'SET_SHOW_ME_TEMPLATE',
  CLICK_TITLEBAR_MAC = 'CLICK_TITLEBAR_MAC',
  TASK_BISECT = 'TASK_BISECT',
  TASK_TEST = 'TASK_TEST',
  TASK_DONE = 'TASK_DONE',
  OUTPUT_ENTRY = 'OUTPUT_ENTRY',
  RELOAD_WINDOW = 'RELOAD_WINDOW',
  SET_NATIVE_THEME = 'SET_NATIVE_THEME',
  SHOW_WINDOW = 'SHOW_WINDOW',
  GET_TEMPLATE_VALUES = 'GET_TEMPLATE_VALUES',
}

export const ipcMainEvents = [
  IpcEvents.FS_SAVE_FIDDLE_DIALOG,
  IpcEvents.FS_SAVE_FIDDLE,
  IpcEvents.SHOW_WARNING_DIALOG,
  IpcEvents.SHOW_LOCAL_VERSION_FOLDER_DIALOG,
  IpcEvents.CONFIRM_QUIT,
  IpcEvents.SET_SHOW_ME_TEMPLATE,
  IpcEvents.BLOCK_ACCELERATORS,
  IpcEvents.CLICK_TITLEBAR_MAC,
  IpcEvents.OUTPUT_ENTRY,
  IpcEvents.TASK_DONE,
  IpcEvents.RELOAD_WINDOW,
  IpcEvents.SET_NATIVE_THEME,
  IpcEvents.SHOW_WINDOW,
  IpcEvents.GET_TEMPLATE_VALUES,
];

export const WEBCONTENTS_READY_FOR_IPC_SIGNAL =
  'WEBCONTENTS_READY_FOR_IPC_SIGNAL';
