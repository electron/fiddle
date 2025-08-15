// Remember to update ambient.d.ts for extending window object
import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

import {
  BlockableAccelerator,
  DownloadVersionParams,
  FiddleEvent,
  FileTransformOperation,
  Files,
  IPackageManager,
  MessageOptions,
  OutputEntry,
  PMOperationOptions,
  PackageJsonOptions,
  RunResult,
  RunnableVersion,
  StartFiddleParams,
} from '../interfaces';
import { IpcEvents, WEBCONTENTS_READY_FOR_IPC_SIGNAL } from '../ipc-events';
import { FiddleTheme } from '../themes-defaults';

const channelMapping: Record<FiddleEvent, IpcEvents> = {
  'before-quit': IpcEvents.BEFORE_QUIT,
  'bisect-task': IpcEvents.TASK_BISECT,
  'clear-console': IpcEvents.CLEAR_CONSOLE,
  'electron-types-changed': IpcEvents.ELECTRON_TYPES_CHANGED,
  'execute-monaco-command': IpcEvents.MONACO_EXECUTE_COMMAND,
  'fiddle-runner-output': IpcEvents.FIDDLE_RUNNER_OUTPUT,
  'fiddle-stopped': IpcEvents.FIDDLE_STOPPED,
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
  'saved-local-fiddle': IpcEvents.SAVED_LOCAL_FIDDLE,
  'save-fiddle-gist': IpcEvents.FS_SAVE_FIDDLE_GIST,
  'select-all-in-editor': IpcEvents.SELECT_ALL_IN_EDITOR,
  'set-show-me-template': IpcEvents.SET_SHOW_ME_TEMPLATE,
  'show-welcome-tour': IpcEvents.SHOW_WELCOME_TOUR,
  'test-task': IpcEvents.TASK_TEST,
  'toggle-bisect': IpcEvents.BISECT_COMMANDS_TOGGLE,
  'toggle-monaco-option': IpcEvents.MONACO_TOGGLE_OPTION,
  'undo-in-editor': IpcEvents.UNDO_IN_EDITOR,
  'version-download-progress': IpcEvents.VERSION_DOWNLOAD_PROGRESS,
  'version-state-changed': IpcEvents.VERSION_STATE_CHANGED,
} as const;

async function preload() {
  await setupFiddleGlobal();
}

export async function setupFiddleGlobal() {
  contextBridge.exposeInMainWorld('ElectronFiddle', {
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
    addModules(
      { dir, packageManager }: PMOperationOptions,
      ...names: Array<string>
    ) {
      return ipcRenderer.invoke(
        IpcEvents.NPM_ADD_MODULES,
        { dir, packageManager },
        ...names,
      );
    },
    arch: process.arch,
    blockAccelerators(acceleratorsToBlock: BlockableAccelerator[]) {
      ipcRenderer.send(IpcEvents.BLOCK_ACCELERATORS, acceleratorsToBlock);
    },
    cleanupDirectory(dir: string) {
      return ipcRenderer.invoke(IpcEvents.CLEANUP_DIRECTORY, dir);
    },
    confirmQuit() {
      ipcRenderer.send(IpcEvents.CONFIRM_QUIT);
    },
    createThemeFile(newTheme: FiddleTheme, name?: string) {
      return ipcRenderer.invoke(IpcEvents.CREATE_THEME_FILE, newTheme, name);
    },
    async deleteUserData(name: string) {
      await ipcRenderer.invoke(IpcEvents.DELETE_USER_DATA, name);
    },
    async downloadVersion(
      version: string,
      opts?: Partial<DownloadVersionParams>,
    ) {
      await ipcRenderer.invoke(IpcEvents.DOWNLOAD_VERSION, version, opts);
    },
    fetchVersions() {
      return ipcRenderer.invoke(IpcEvents.FETCH_VERSIONS);
    },
    getElectronTypes(ver: RunnableVersion) {
      return ipcRenderer.invoke(IpcEvents.GET_ELECTRON_TYPES, ver);
    },
    getLatestStable() {
      return ipcRenderer.sendSync(IpcEvents.GET_LATEST_STABLE);
    },
    getLocalVersionState(ver: RunnableVersion) {
      return ipcRenderer.sendSync(IpcEvents.GET_LOCAL_VERSION_STATE, ver);
    },
    getOldestSupportedMajor() {
      return ipcRenderer.sendSync(IpcEvents.GET_OLDEST_SUPPORTED_MAJOR);
    },
    getReleasedVersions() {
      return ipcRenderer.sendSync(IpcEvents.GET_RELEASED_VERSIONS);
    },
    getReleaseInfo(version: string) {
      return ipcRenderer.invoke(IpcEvents.GET_RELEASE_INFO, version);
    },
    getAvailableThemes() {
      return ipcRenderer.invoke(IpcEvents.GET_AVAILABLE_THEMES);
    },
    getIsPackageManagerInstalled(
      packageManager: IPackageManager,
      ignoreCache?: boolean,
    ) {
      return ipcRenderer.invoke(
        IpcEvents.NPM_IS_PM_INSTALLED,
        packageManager,
        ignoreCache,
      );
    },
    getNodeTypes(version: string) {
      return ipcRenderer.invoke(IpcEvents.GET_NODE_TYPES, version);
    },
    getProjectName(localPath?: string) {
      return ipcRenderer.invoke(IpcEvents.GET_PROJECT_NAME, localPath);
    },
    getTemplate: (version: string) =>
      ipcRenderer.invoke(IpcEvents.GET_TEMPLATE, version),
    getTemplateValues: (name: string) => {
      return ipcRenderer.invoke(IpcEvents.GET_TEMPLATE_VALUES, name);
    },
    isReleasedMajor(major: number) {
      return ipcRenderer.invoke(IpcEvents.IS_RELEASED_MAJOR, major);
    },
    getTestTemplate: () => ipcRenderer.invoke(IpcEvents.GET_TEST_TEMPLATE),
    getUsername: () => ipcRenderer.sendSync(IpcEvents.GET_USERNAME),
    getVersionState: (version: string) =>
      ipcRenderer.sendSync(IpcEvents.GET_VERSION_STATE, version),
    isDevMode: ipcRenderer.sendSync(IpcEvents.IS_DEV_MODE),
    macTitlebarClicked() {
      ipcRenderer.send(IpcEvents.CLICK_TITLEBAR_MAC);
    },
    onGetFiles(
      callback: (
        options: PackageJsonOptions | undefined,
        transforms: Array<FileTransformOperation>,
      ) => Promise<{ localPath?: string; files: Files }>,
    ) {
      ipcRenderer.removeAllListeners(IpcEvents.GET_FILES);
      ipcRenderer.on(
        IpcEvents.GET_FILES,
        async (e, { options, transforms }) => {
          const { localPath, files } = await callback(options, transforms);
          e.ports[0].postMessage({ localPath, files: [...files.entries()] });
        },
      );
    },
    async openThemeFolder() {
      await ipcRenderer.invoke(IpcEvents.OPEN_THEME_FOLDER);
    },
    packageRun({ dir, packageManager }: PMOperationOptions, command: string) {
      return ipcRenderer.invoke(
        IpcEvents.NPM_PACKAGE_RUN,
        { dir, packageManager },
        command,
      );
    },
    pathExists: (path: string) =>
      ipcRenderer.sendSync(IpcEvents.PATH_EXISTS, path),
    platform: process.platform,
    pushOutputEntry(entry: OutputEntry) {
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
    async removeVersion(version: string) {
      return ipcRenderer.invoke(IpcEvents.REMOVE_VERSION, version);
    },
    saveFilesToTemp(files: Files) {
      return ipcRenderer.invoke(IpcEvents.SAVE_FILES_TO_TEMP, [
        ...files.entries(),
      ]);
    },
    selectLocalVersion: () => {
      return ipcRenderer.invoke(IpcEvents.LOAD_LOCAL_VERSION_FOLDER);
    },
    sendReady() {
      ipcRenderer.send(WEBCONTENTS_READY_FOR_IPC_SIGNAL);
    },
    setNativeTheme(theme: 'dark' | 'light' | 'system') {
      ipcRenderer.send(IpcEvents.SET_NATIVE_THEME, theme);
    },
    setShowMeTemplate(template?: string) {
      ipcRenderer.send(IpcEvents.SET_SHOW_ME_TEMPLATE, template);
    },
    showWarningDialog(messageOptions: MessageOptions) {
      ipcRenderer.send(IpcEvents.SHOW_WARNING_DIALOG, messageOptions);
    },
    showWindow() {
      ipcRenderer.send(IpcEvents.SHOW_WINDOW);
    },
    async startFiddle(params: StartFiddleParams) {
      await ipcRenderer.invoke(IpcEvents.START_FIDDLE, params);
    },
    stopFiddle() {
      ipcRenderer.send(IpcEvents.STOP_FIDDLE);
    },
    taskDone(result: RunResult) {
      ipcRenderer.send(IpcEvents.TASK_DONE, result);
    },
    themePath: await ipcRenderer.sendSync(IpcEvents.GET_THEME_PATH),
    async uncacheTypes(ver: RunnableVersion) {
      await ipcRenderer.invoke(IpcEvents.UNCACHE_TYPES, ver);
    },
    async unwatchElectronTypes() {
      await ipcRenderer.invoke(IpcEvents.UNWATCH_ELECTRON_TYPES);
    },
  });
}

preload();
