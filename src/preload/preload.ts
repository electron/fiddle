// Remember to update ambient.d.ts for extending window object
import { IpcRendererEvent, ipcRenderer } from 'electron';

import { FiddleEvent } from '../interfaces';
import { IpcEvents, WEBCONTENTS_READY_FOR_IPC_SIGNAL } from '../ipc-events';
import { isReleasedMajor } from '../renderer/versions';
import { FiddleTheme } from '../themes-defaults';

const channelMapping: Record<FiddleEvent, IpcEvents> = {
  'before-quit': IpcEvents.BEFORE_QUIT,
  'bisect-task': IpcEvents.TASK_BISECT,
  'clear-console': IpcEvents.CLEAR_CONSOLE,
  'execute-monaco-command': IpcEvents.MONACO_EXECUTE_COMMAND,
  'load-example': IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST,
  'load-gist': IpcEvents.LOAD_GIST_REQUEST,
  'make-fiddle': IpcEvents.FIDDLE_MAKE,
  'new-fiddle': IpcEvents.FS_NEW_FIDDLE,
  'new-test': IpcEvents.FS_NEW_TEST,
  'open-fiddle': IpcEvents.FS_OPEN_FIDDLE,
  'open-settings': IpcEvents.OPEN_SETTINGS,
  'open-template': IpcEvents.FS_OPEN_TEMPLATE,
  'package-fiddle': IpcEvents.FIDDLE_PACKAGE,
  'redo-in-editor': IpcEvents.REDO_IN_EDITOR,
  'run-fiddle': IpcEvents.FIDDLE_RUN,
  'save-fiddle': IpcEvents.FS_SAVE_FIDDLE,
  'save-fiddle-forge': IpcEvents.FS_SAVE_FIDDLE_FORGE,
  'save-fiddle-gist': IpcEvents.FS_SAVE_FIDDLE_GIST,
  'select-all-in-editor': IpcEvents.SELECT_ALL_IN_EDITOR,
  'set-show-me-template': IpcEvents.SET_SHOW_ME_TEMPLATE,
  'show-welcome-tour': IpcEvents.SHOW_WELCOME_TOUR,
  'test-task': IpcEvents.TASK_TEST,
  'toggle-bisect': IpcEvents.BISECT_COMMANDS_TOGGLE,
  'toggle-monaco-option': IpcEvents.MONACO_TOGGLE_OPTION,
  'undo-in-editor': IpcEvents.UNDO_IN_EDITOR,
} as const;

async function preload() {
  await setupFiddleGlobal();
}

export async function setupFiddleGlobal() {
  window.ElectronFiddle = {
    addEventListener(
      type: FiddleEvent,
      listener: (...args: any[]) => void,
      options?: { signal: AbortSignal },
    ) {
      const channel = channelMapping[type];
      if (channel) {
        const ipcListener = (_event: IpcRendererEvent, ...args: any[]) => {
          listener(...args);
        };
        ipcRenderer.on(channel, ipcListener);
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            ipcRenderer.off(channel, ipcListener);
          });
        }
      }
    },
    app: null as any, // will be set in main.tsx
    appPaths: await ipcRenderer.invoke(IpcEvents.GET_APP_PATHS),
    arch: process.arch,
    blockAccelerators(acceleratorsToBlock) {
      ipcRenderer.send(IpcEvents.BLOCK_ACCELERATORS, acceleratorsToBlock);
    },
    confirmQuit() {
      ipcRenderer.send(IpcEvents.CONFIRM_QUIT);
    },
    createThemeFile(newTheme: FiddleTheme, name?: string) {
      return ipcRenderer.invoke(IpcEvents.CREATE_THEME_FILE, newTheme, name);
    },
    getAvailableThemes() {
      return ipcRenderer.invoke(IpcEvents.GET_AVAILABLE_THEMES);
    },
    getTemplate: (version: string) =>
      ipcRenderer.invoke(IpcEvents.GET_TEMPLATE, version),
    getTemplateValues: (name: string) => {
      return ipcRenderer.invoke(IpcEvents.GET_TEMPLATE_VALUES, name);
    },
    getTestTemplate: () => ipcRenderer.invoke(IpcEvents.GET_TEST_TEMPLATE),
    isDevMode: ipcRenderer.sendSync(IpcEvents.IS_DEV_MODE),
    macTitlebarClicked() {
      ipcRenderer.send(IpcEvents.CLICK_TITLEBAR_MAC);
    },
    monaco: null as any, // will be set in main.tsx
    async openThemeFolder() {
      await ipcRenderer.invoke(IpcEvents.OPEN_THEME_FOLDER);
    },
    platform: process.platform,
    pushOutputEntry(entry) {
      ipcRenderer.send(IpcEvents.OUTPUT_ENTRY, entry);
    },
    reloadWindows() {
      ipcRenderer.send(IpcEvents.RELOAD_WINDOW);
    },
    readThemeFile(name?: string) {
      return ipcRenderer.invoke(IpcEvents.READ_THEME_FILE, name);
    },
    removeAllListeners(type: FiddleEvent) {
      const channel = channelMapping[type];
      if (channel) {
        ipcRenderer.removeAllListeners(channel);
      }
    },
    selectLocalVersion: () => {
      return ipcRenderer.invoke(IpcEvents.LOAD_LOCAL_VERSION_FOLDER);
    },
    sendReady() {
      ipcRenderer.send(WEBCONTENTS_READY_FOR_IPC_SIGNAL);
    },
    setNativeTheme(theme) {
      ipcRenderer.send(IpcEvents.SET_NATIVE_THEME, theme);
    },
    setShowMeTemplate() {
      ipcRenderer.send(IpcEvents.SET_SHOW_ME_TEMPLATE);
    },
    showSaveDialog() {
      ipcRenderer.send(IpcEvents.FS_SAVE_FIDDLE_DIALOG);
    },
    showWarningDialog(messageOptions) {
      ipcRenderer.send(IpcEvents.SHOW_WARNING_DIALOG, messageOptions);
    },
    showWindow() {
      ipcRenderer.send(IpcEvents.SHOW_WINDOW);
    },
    taskDone(result) {
      ipcRenderer.send(IpcEvents.TASK_DONE, result);
    },
    themePath: await ipcRenderer.sendSync(IpcEvents.GET_THEME_PATH),
  };

  // TODO(dsanders11): Remove this when Electron versions move to main process
  ipcRenderer.on(IpcEvents.IS_RELEASED_MAJOR, (e, { major }) => {
    e.ports[0].postMessage(isReleasedMajor(major));
  });
}

preload();
