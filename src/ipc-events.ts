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
  GET_TEMPLATE = 'GET_TEMPLATE',
  GET_TEST_TEMPLATE = 'GET_TEST_TEMPLATE',
  IS_RELEASED_MAJOR = 'IS_RELEASED_MAJOR',
  CREATE_THEME_FILE = 'CREATE_THEME_FILE',
  GET_AVAILABLE_THEMES = 'GET_AVAILABLE_THEMES',
  OPEN_THEME_FOLDER = 'OPEN_THEME_FOLDER',
  READ_THEME_FILE = 'READ_THEME_FILE',
  GET_THEME_PATH = 'GET_THEME_PATH',
  IS_DEV_MODE = 'IS_DEV_MODE',
  NPM_ADD_MODULES = 'NPM_ADD_MODULES',
  NPM_IS_PM_INSTALLED = 'NPM_IS_PM_INSTALLED',
  NPM_PACKAGE_RUN = 'NPM_PACKAGE_RUN',
  FETCH_VERSIONS = 'FETCH_VERSIONS',
  GET_LATEST_STABLE = 'GET_LATEST_STABLE',
  GET_LOCAL_VERSION_STATE = 'GET_LOCAL_VERSION_STATE',
  GET_OLDEST_SUPPORTED_MAJOR = 'GET_OLDEST_SUPPORTED_MAJOR',
  GET_RELEASED_VERSIONS = 'GET_RELEASED_VERSIONS',
  GET_RELEASE_INFO = 'GET_RELEASE_INFO',
  GET_PROJECT_NAME = 'GET_PROJECT_NAME',
  GET_USERNAME = 'GET_USERNAME',
  PATH_EXISTS = 'PATH_EXISTS',
  GET_NODE_TYPES = 'GET_NODE_TYPES',
}

export const ipcMainEvents = [
  IpcEvents.FS_SAVE_FIDDLE_DIALOG,
  IpcEvents.FS_SAVE_FIDDLE,
  IpcEvents.SHOW_WARNING_DIALOG,
  IpcEvents.LOAD_LOCAL_VERSION_FOLDER,
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
  IpcEvents.GET_TEMPLATE,
  IpcEvents.GET_TEST_TEMPLATE,
  IpcEvents.CREATE_THEME_FILE,
  IpcEvents.GET_AVAILABLE_THEMES,
  IpcEvents.OPEN_THEME_FOLDER,
  IpcEvents.READ_THEME_FILE,
  IpcEvents.GET_THEME_PATH,
  IpcEvents.IS_DEV_MODE,
  IpcEvents.NPM_ADD_MODULES,
  IpcEvents.NPM_IS_PM_INSTALLED,
  IpcEvents.NPM_PACKAGE_RUN,
  IpcEvents.FETCH_VERSIONS,
  IpcEvents.GET_LATEST_STABLE,
  IpcEvents.GET_LOCAL_VERSION_STATE,
  IpcEvents.GET_OLDEST_SUPPORTED_MAJOR,
  IpcEvents.GET_RELEASED_VERSIONS,
  IpcEvents.GET_RELEASE_INFO,
  IpcEvents.GET_PROJECT_NAME,
  IpcEvents.GET_USERNAME,
  IpcEvents.PATH_EXISTS,
  IpcEvents.GET_NODE_TYPES,
];

export const WEBCONTENTS_READY_FOR_IPC_SIGNAL =
  'WEBCONTENTS_READY_FOR_IPC_SIGNAL';
