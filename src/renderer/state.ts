import * as fs from 'fs-extra';
import * as MonacoType from 'monaco-editor';
import semver from 'semver';
import { action, autorun, computed, observable, when } from 'mobx';

import {
  BlockableAccelerator,
  ElectronReleaseChannel,
  GenericDialogOptions,
  GenericDialogType,
  GistActionState,
  MAIN_JS,
  OutputEntry,
  OutputOptions,
  RunnableVersion,
  SetFiddleOptions,
  Version,
  VersionSource,
  VersionState,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { getName } from '../utils/get-name';
import { normalizeVersion } from '../utils/normalize-version';
import { removeBinary, setupBinary } from './binary';
import { Bisector } from './bisect';
import { EditorMosaic } from './editor-mosaic';
import { getTemplate, isContentUnchanged } from './content';
import {
  getLocalTypePathForVersion,
  updateEditorTypeDefinitions,
} from './fetch-types';
import { ipcRendererManager } from './ipc';
import { activateTheme } from './themes';

import { sortVersions } from '../utils/sort-versions';
import { IPackageManager } from './npm';
import {
  addLocalVersion,
  getDefaultVersion,
  getElectronVersions,
  getOldestSupportedVersion,
  getReleaseChannel,
  getUpdatedElectronVersions,
  saveLocalVersions,
} from './versions';

export type Editor = MonacoType.editor.IStandaloneCodeEditor;

/**
 * The application's state. Exported as a singleton below.
 *
 * @export
 * @class AppState
 */
export class AppState {
  // -- Persisted settings ------------------
  @observable public theme: string | null = localStorage.getItem('theme');
  @observable public gitHubAvatarUrl: string | null = localStorage.getItem(
    'gitHubAvatarUrl',
  );
  @observable public gitHubName: string | null = localStorage.getItem(
    'gitHubName',
  );
  @observable public gitHubLogin: string | null = localStorage.getItem(
    'gitHubLogin',
  );
  @observable public gitHubToken: string | null =
    localStorage.getItem('gitHubToken') || null;
  @observable public gitHubPublishAsPublic = !!this.retrieve(
    'gitHubPublishAsPublic',
  );
  @observable
  public channelsToShow: Array<ElectronReleaseChannel> = (this.retrieve(
    'channelsToShow',
  ) as Array<ElectronReleaseChannel>) || [
    ElectronReleaseChannel.stable,
    ElectronReleaseChannel.beta,
  ];
  @observable public showObsoleteVersions = !!(
    this.retrieve('showObsoleteVersions') ?? false
  );
  @observable public showUndownloadedVersions = !!(
    this.retrieve('showUndownloadedVersions') ?? true
  );
  @observable public isKeepingUserDataDirs = !!this.retrieve(
    'isKeepingUserDataDirs',
  );
  @observable public isEnablingElectronLogging = !!this.retrieve(
    'isEnablingElectronLogging',
  );
  @observable public isClearingConsoleOnRun = !!this.retrieve(
    'isClearingConsoleOnRun',
  );
  @observable public isUsingSystemTheme = !!(
    this.retrieve('isUsingSystemTheme') ?? true
  );
  @observable public executionFlags: Array<string> =
    (this.retrieve('executionFlags') as Array<string>) === null
      ? []
      : (this.retrieve('executionFlags') as Array<string>);
  @observable public environmentVariables: Array<string> =
    (this.retrieve('environmentVariables') as Array<string>) === null
      ? []
      : (this.retrieve('environmentVariables') as Array<string>);
  @observable public packageManager: IPackageManager =
    (localStorage.getItem('packageManager') as IPackageManager) || 'npm';
  @observable public acceleratorsToBlock: Array<BlockableAccelerator> =
    (this.retrieve('acceleratorsToBlock') as Array<BlockableAccelerator>) || [];
  // -- Various session-only state ------------------
  @observable public gistId: string | undefined;
  @observable public readonly versions: Record<string, RunnableVersion>;
  @observable public version: string;
  @observable public output: Array<OutputEntry> = [];
  @observable public localPath: string | undefined;
  @observable public genericDialogOptions: GenericDialogOptions = {
    type: GenericDialogType.warning,
    label: '' as string | JSX.Element,
    ok: 'Okay',
    cancel: 'Cancel',
    wantsInput: false,
    placeholder: '',
  };
  @observable public readonly editorMosaic = new EditorMosaic();
  @observable public genericDialogLastResult: boolean | null = null;
  @observable public genericDialogLastInput: string | null = null;
  @observable public templateName: string | undefined;
  @observable public localTypeWatcher: fs.FSWatcher | undefined;
  @observable public Bisector: Bisector | undefined;

  @observable public activeGistAction: GistActionState = GistActionState.none;
  @observable public isRunning = false;
  @observable public isAutoBisecting = false;
  @observable public isInstallingModules = false;
  @observable public isUpdatingElectronVersions = false;
  @observable public isQuitting = false;

  // -- Various "isShowing" settings ------------------
  @observable public isBisectCommandShowing: boolean;
  @observable public isConsoleShowing = false;
  @observable public isTokenDialogShowing = false;
  @observable public isGenericDialogShowing = false;
  @observable public isSettingsShowing = false;
  @observable public isBisectDialogShowing = false;
  @observable public isAddVersionDialogShowing = false;
  @observable public isThemeDialogShowing = false;
  @observable public isTourShowing = !localStorage.getItem('hasShownTour');

  // -- Editor Values stored when we close the editor ------------------
  private outputBuffer = '';
  private name: string;
  private readonly defaultVersion: string;
  public appData: string;

  constructor(versions: RunnableVersion[]) {
    // Bind all actions
    this.downloadVersion = this.downloadVersion.bind(this);
    this.pushError = this.pushError.bind(this);
    this.pushOutput = this.pushOutput.bind(this);
    this.flushOutput = this.flushOutput.bind(this);
    this.getVersion = this.getVersion.bind(this);
    this.hasVersion = this.hasVersion.bind(this);
    this.removeVersion = this.removeVersion.bind(this);
    this.setVersion = this.setVersion.bind(this);
    this.showTour = this.showTour.bind(this);
    this.signOutGitHub = this.signOutGitHub.bind(this);
    this.toggleBisectCommands = this.toggleBisectCommands.bind(this);
    this.toggleAuthDialog = this.toggleAuthDialog.bind(this);
    this.toggleConsole = this.toggleConsole.bind(this);
    this.clearConsole = this.clearConsole.bind(this);
    this.toggleSettings = this.toggleSettings.bind(this);
    this.toggleBisectDialog = this.toggleBisectDialog.bind(this);
    this.updateElectronVersions = this.updateElectronVersions.bind(this);
    this.setIsQuitting = this.setIsQuitting.bind(this);
    this.setShowMeMenu = this.setShowMeMenu.bind(this);
    this.addAcceleratorToBlock = this.addAcceleratorToBlock.bind(this);
    this.removeAcceleratorToBlock = this.removeAcceleratorToBlock.bind(this);
    this.hideChannels = this.hideChannels.bind(this);
    this.showChannels = this.showChannels.bind(this);

    // init fields
    this.versions = Object.fromEntries(versions.map((v) => [v.version, v]));
    this.defaultVersion = getDefaultVersion(versions);
    this.version = this.defaultVersion;

    ipcRendererManager.removeAllListeners(IpcEvents.BEFORE_QUIT);
    ipcRendererManager.removeAllListeners(IpcEvents.BISECT_COMMANDS_TOGGLE);
    ipcRendererManager.removeAllListeners(IpcEvents.CLEAR_CONSOLE);
    ipcRendererManager.removeAllListeners(IpcEvents.OPEN_SETTINGS);
    ipcRendererManager.removeAllListeners(IpcEvents.SHOW_WELCOME_TOUR);

    ipcRendererManager.on(IpcEvents.OPEN_SETTINGS, this.toggleSettings);
    ipcRendererManager.on(IpcEvents.SHOW_WELCOME_TOUR, this.showTour);
    ipcRendererManager.on(IpcEvents.CLEAR_CONSOLE, this.clearConsole);
    ipcRendererManager.on(
      IpcEvents.BISECT_COMMANDS_TOGGLE,
      this.toggleBisectCommands,
    );
    ipcRendererManager.on(IpcEvents.BEFORE_QUIT, this.setIsQuitting);

    // Setup auto-runs
    autorun(() => this.save('theme', this.theme));
    autorun(() =>
      this.save('isClearingConsoleOnRun', this.isClearingConsoleOnRun),
    );
    autorun(() => this.save('isUsingSystemTheme', this.isUsingSystemTheme));
    autorun(() => this.save('gitHubAvatarUrl', this.gitHubAvatarUrl));
    autorun(() => this.save('gitHubLogin', this.gitHubLogin));
    autorun(() => this.save('gitHubName', this.gitHubName));
    autorun(() => this.save('gitHubToken', this.gitHubToken));
    autorun(() =>
      this.save('gitHubPublishAsPublic', this.gitHubPublishAsPublic),
    );
    autorun(() =>
      this.save('isKeepingUserDataDirs', this.isKeepingUserDataDirs),
    );
    autorun(() =>
      this.save('isEnablingElectronLogging', this.isEnablingElectronLogging),
    );
    autorun(() => this.save('executionFlags', this.executionFlags));
    autorun(() => this.save('version', this.version));
    autorun(() => this.save('channelsToShow', this.channelsToShow));
    autorun(() =>
      this.save('showUndownloadedVersions', this.showUndownloadedVersions),
    );
    autorun(() => this.save('showObsoleteVersions', this.showObsoleteVersions));
    autorun(() => this.save('packageManager', this.packageManager ?? 'npm'));
    autorun(() => this.save('acceleratorsToBlock', this.acceleratorsToBlock));

    // Update our known versions
    this.updateElectronVersions();

    // Make sure the console isn't all empty and sad
    this.pushOutput('Console ready 🔬');

    // set blocked shortcuts
    ipcRendererManager.send(IpcEvents.BLOCK_ACCELERATORS, [
      ...this.acceleratorsToBlock,
    ]);

    this.setVersion(this.version);
  }

  /**
   * @returns {string} the title, e.g. appname, fiddle name, state
   */
  @computed get title(): string {
    const { gistId, localPath, templateName } = this;
    const { isEdited } = this.editorMosaic;
    const tokens = [];

    if (localPath) {
      tokens.push(localPath);
    } else if (templateName) {
      tokens.push(templateName);
    } else if (gistId) {
      tokens.push(`gist.github.com/${gistId}`);
    }

    if (isEdited) {
      tokens.push('Unsaved');
    }

    if (tokens.length > 0) {
      tokens.unshift('-');
    }

    tokens.unshift('Electron Fiddle');
    return tokens.join(' ');
  }

  /**
   * Returns the current RunnableVersion or the first
   * one that can be found.
   */
  @computed get currentElectronVersion(): RunnableVersion {
    return this.versions[this.version] || this.versions[this.defaultVersion];
  }

  /**
   * Returns an array of Electron versions to show given the
   * current settings for states and channels to display
   */
  @computed get versionsToShow(): Array<RunnableVersion> {
    const {
      channelsToShow,
      showObsoleteVersions,
      showUndownloadedVersions,
      versions,
    } = this;
    const oldest = semver.parse(getOldestSupportedVersion());

    const filter = (ver: RunnableVersion) =>
      ver &&
      (showUndownloadedVersions ||
        ver.state === VersionState.unzipping ||
        ver.state === VersionState.ready) &&
      (showObsoleteVersions ||
        !oldest ||
        oldest.compareMain(ver.version) <= 0) &&
      channelsToShow.includes(getReleaseChannel(ver));

    return sortVersions(Object.values(versions).filter(filter));
  }

  /**
   * Update the Electron versions: First, fetch them from GitHub,
   * then update their respective downloaded state.
   *
   * Fails silently.
   */
  @action public async updateElectronVersions() {
    this.isUpdatingElectronVersions = true;

    try {
      this.addNewVersions(await getUpdatedElectronVersions());
    } catch (error) {
      console.warn(`State: Could not update Electron versions`, error);
    }

    this.isUpdatingElectronVersions = false;
  }

  public async getName() {
    this.name ||= await getName(this);
    return this.name;
  }

  @action public hideChannels(channels: Array<ElectronReleaseChannel>) {
    this.channelsToShow = this.channelsToShow.filter(
      (ch) => !channels.includes(ch),
    );
  }

  @action public showChannels(channels: Array<ElectronReleaseChannel>) {
    const s = new Set<ElectronReleaseChannel>([
      ...this.channelsToShow,
      ...channels,
    ]);
    this.channelsToShow = [...s.values()];
  }

  @action public toggleConsole() {
    this.isConsoleShowing = !this.isConsoleShowing;
  }

  @action public clearConsole() {
    this.output = [];
  }

  @action public toggleBisectCommands() {
    // guard against hiding the commands when executing a bisect
    if (!this.Bisector && !this.isBisectDialogShowing) {
      this.isBisectCommandShowing = !this.isBisectCommandShowing;
    }
  }

  @action public toggleAddVersionDialog() {
    this.isAddVersionDialogShowing = !this.isAddVersionDialogShowing;
  }

  @action public toggleAddMonacoThemeDialog() {
    this.isThemeDialogShowing = !this.isThemeDialogShowing;
  }

  @action public toggleAuthDialog() {
    this.isTokenDialogShowing = !this.isTokenDialogShowing;
  }

  @action public toggleGenericDialog() {
    this.isGenericDialogShowing = !this.isGenericDialogShowing;

    if (this.isGenericDialogShowing) {
      this.genericDialogLastResult = null;
    }
  }

  @action public toggleBisectDialog() {
    this.isBisectDialogShowing = !this.isBisectDialogShowing;
  }

  @action public toggleSettings() {
    // We usually don't lose editor focus,
    // so you can still type. Let's force-blur.
    (document.activeElement as HTMLInputElement).blur();

    this.resetView({ isSettingsShowing: !this.isSettingsShowing });
  }

  @action public setIsQuitting() {
    this.isQuitting = true;
  }

  @action public disableTour() {
    this.resetView();
    localStorage.setItem('hasShownTour', 'true');
  }

  @action public showTour() {
    this.resetView({ isTourShowing: true });
  }

  @action public setTheme(fileName?: string) {
    this.theme = fileName || '';
    activateTheme(undefined, undefined, fileName);
    window.ElectronFiddle.app.loadTheme();
  }

  @action public setGenericDialogOptions(opts: GenericDialogOptions) {
    this.genericDialogOptions = {
      ok: 'Okay',
      cancel: 'Cancel',
      wantsInput: false,
      placeholder: '',
      ...opts,
    };
  }

  @action public addLocalVersion(input: Version) {
    addLocalVersion(input);
    this.addNewVersions(getElectronVersions());
  }

  @action private addNewVersions(versions: RunnableVersion[]) {
    for (const ver of versions) {
      this.versions[ver.version] ||= ver;
    }
  }

  /**
   * Remove a version of Electron
   *
   * @param {string} input
   * @returns {Promise<void>}
   */
  @action public async removeVersion(ver: RunnableVersion) {
    const { version } = ver;

    if (ver.state !== VersionState.ready) {
      console.log(`State: Version ${version} already removed, doing nothing`);
      return;
    }

    if (ver === this.currentElectronVersion) {
      console.log(`State: Not removing active version ${version}`);
      return;
    }

    // Actually remove
    console.log(`State: Removing Electron ${version}`);
    if (ver.source === VersionSource.local) {
      delete this.versions[version];
      saveLocalVersions(Object.values(this.versions));
    } else {
      await removeBinary(ver);
    }
  }

  /**
   * Download a version of Electron.
   *
   * @param {string} input
   * @returns {Promise<void>}
   */
  @action public async downloadVersion(ver: RunnableVersion) {
    const { source, state, version } = ver;

    const isRemote = source === VersionSource.remote;
    const isReady = state === VersionState.ready;
    if (!isRemote || isReady) {
      console.log(`State: Already have version ${version}; not downloading.`);
      return;
    }

    console.log(`State: Downloading Electron ${version}`);
    await setupBinary(ver);
  }

  public hasVersion(input: string): boolean {
    return !!this.getVersion(input);
  }

  public getVersion(input: string): RunnableVersion | null {
    return this.versions[normalizeVersion(input)];
  }

  /**
   * Select a version of Electron (and download it if necessary).
   *
   * @param {string} input
   * @returns {Promise<void>}
   */
  @action public async setVersion(input: string) {
    const ver = this.getVersion(input);
    if (!ver) {
      console.warn(`State: setVersion() got an unknown version ${input}`);
      await this.setVersion(this.versionsToShow[0].version);
      return;
    }

    const { version } = ver;
    console.log(`State: Switching to Electron ${version}`);

    // Should we update the editor?
    if (await isContentUnchanged(MAIN_JS, this.version)) {
      const editorValues = await getTemplate(version);

      const options: SetFiddleOptions = { templateName: version };
      await window.ElectronFiddle.app.replaceFiddle(editorValues, options);
    }

    this.version = version;

    // Update TypeScript definitions
    if (ver.source === VersionSource.local) {
      const typePath = getLocalTypePathForVersion(ver);
      console.info(
        `TypeDefs: Watching file for local version ${version} at path ${typePath}`,
      );
      try {
        this.localTypeWatcher = fs.watch(typePath!, async () => {
          console.info(
            `TypeDefs: Noticed file change at ${typePath}. Updating editor typedefs.`,
          );
          await updateEditorTypeDefinitions(ver);
        });
      } catch (err) {
        console.info('TypeDefs: Unable to start watching.');
      }
    } else if (!!this.localTypeWatcher) {
      console.info(
        `TypeDefs: Switched to downloaded version ${version}. Unwatching local typedefs.`,
      );
      this.localTypeWatcher.close();
      this.localTypeWatcher = undefined;
    }
    await updateEditorTypeDefinitions(ver);

    // Fetch new binaries, maybe?
    await this.downloadVersion(ver);
  }

  /**
   * The equivalent of signing out.
   *
   * @returns {void}
   */
  @action public signOutGitHub(): void {
    this.gitHubAvatarUrl = null;
    this.gitHubLogin = null;
    this.gitHubToken = null;
    this.gitHubName = null;
  }

  @action public async runConfirmationDialog(
    opts: GenericDialogOptions,
  ): Promise<boolean> {
    this.setGenericDialogOptions(opts);
    this.isGenericDialogShowing = true;
    await when(() => !this.isGenericDialogShowing);
    return !!this.genericDialogLastResult;
  }

  /**
   * Ensure that any buffered console output is
   * printed before a running Fiddle is stopped.
   *
   * @returns {void}
   */
  @action public flushOutput(): void {
    this.pushOutput('\r\n', { bypassBuffer: false });
  }

  /**
   * Push output to the application's state. Accepts a buffer or a string as input,
   * attaches a timestamp, and pushes into the store.
   *
   * @param {(string | Buffer)} data
   */
  @action public pushOutput(
    data: string | Buffer,
    options: OutputOptions = { isNotPre: false, bypassBuffer: true },
  ) {
    let strData = data.toString();
    const { isNotPre, bypassBuffer } = options;

    if (process.platform === 'win32' && bypassBuffer === false) {
      this.outputBuffer += strData;
      strData = this.outputBuffer;
      const parts = strData.split('\r\n');
      for (let partIndex = 0; partIndex < parts.length; partIndex++) {
        const part = parts[partIndex];
        if (partIndex === parts.length - 1) {
          this.outputBuffer = part;
          continue;
        }

        this.pushOutput(part, { isNotPre, bypassBuffer: true });
      }

      return;
    }

    if (strData.startsWith('Debugger listening on ws://')) return;
    if (strData === 'For help see https://nodejs.org/en/docs/inspector') return;

    const entry: OutputEntry = {
      timestamp: Date.now(),
      text: strData.trim(),
      isNotPre,
    };
    ipcRendererManager.send(IpcEvents.OUTPUT_ENTRY, entry);
    this.output.push(entry);
  }

  /**
   * Little convenience method that pushes message and error.
   *
   * @param {string} message
   * @param {Error} error
   */
  @action public pushError(message: string, error: Error) {
    this.pushOutput(`⚠️ ${message}. Error encountered:`);
    this.pushOutput(error.toString());
    console.warn(error);
  }

  @action public async setShowMeMenu() {
    ipcRendererManager.send(IpcEvents.SET_SHOW_ME_TEMPLATE, this.templateName);
  }

  @action public async addAcceleratorToBlock(acc: BlockableAccelerator) {
    if (!this.acceleratorsToBlock.includes(acc)) {
      this.acceleratorsToBlock = [...this.acceleratorsToBlock, acc];
      ipcRendererManager.send(IpcEvents.BLOCK_ACCELERATORS, [
        ...this.acceleratorsToBlock,
      ]);
    }
  }

  @action public async removeAcceleratorToBlock(acc: BlockableAccelerator) {
    if (this.acceleratorsToBlock.includes(acc)) {
      this.acceleratorsToBlock = this.acceleratorsToBlock.filter(
        (a) => a !== acc,
      );
      ipcRendererManager.send(IpcEvents.BLOCK_ACCELERATORS, [
        ...this.acceleratorsToBlock,
      ]);
    }
  }
  /**
   * Resets the view, optionally with certain view flags enabled.
   *
   * @param {Record<string, boolean>} [additionalOptions]
   * @memberof AppState
   */
  @action private resetView(additionalOptions: Record<string, boolean> = {}) {
    this.isAddVersionDialogShowing = false;
    this.isConsoleShowing = false;
    this.isSettingsShowing = false;
    this.isThemeDialogShowing = false;
    this.isTokenDialogShowing = false;
    this.isTourShowing = false;

    for (const [key, val] of Object.entries(additionalOptions)) {
      this[key] = val;
    }

    this.setPageHash();
  }

  /**
   * Updates the pages url with a hash element that allows the main
   * process to quickly determine if there's a view open.
   *
   * @private
   * @memberof AppState
   */
  @action private setPageHash() {
    let hash = '';

    if (this.isSettingsShowing) {
      hash = 'settings';
    }

    window.location.hash = hash;
  }

  /**
   * Save a key/value to localStorage.
   *
   * @param {string} key
   * @param {(string | number | object)} [value]
   */
  private save(
    key: string,
    value?:
      | string
      | number
      | Array<any>
      | Record<string, unknown>
      | null
      | boolean,
  ) {
    if (value !== null && value !== undefined) {
      const _value =
        typeof value === 'object' ? JSON.stringify(value) : value.toString();

      localStorage.setItem(key, _value);
    } else {
      localStorage.removeItem(key);
    }
  }

  /**
   * Fetch data from localStorage.
   *
   * @template T
   * @param {string} key
   * @returns {(T | string | null)}
   */
  private retrieve<T>(key: string): T | string | null {
    const value = localStorage.getItem(key);

    return JSON.parse(value || 'null') as T;
  }
}
