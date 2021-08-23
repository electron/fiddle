import * as fs from 'fs-extra';
import { action, autorun, computed, observable, when } from 'mobx';

import {
  BlockableAccelerator,
  ElectronReleaseChannel,
  GenericDialogOptions,
  GenericDialogType,
  GistActionState,
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
import { getTemplate } from './content';
import { ipcRendererManager } from './ipc';

import { sortVersions } from '../utils/sort-versions';
import { IPackageManager } from './npm';
import {
  addLocalVersion,
  fetchVersions,
  getDefaultVersion,
  getElectronVersions,
  getOldestSupportedMajor,
  getReleaseChannel,
  makeRunnable,
  saveLocalVersions,
} from './versions';

/**
 * The application's state. Exported as a singleton below.
 *
 * @export
 * @class AppState
 */
export class AppState {
  private readonly timeFmt = new Intl.DateTimeFormat([], {
    timeStyle: 'medium',
  });

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
  @observable public Bisector: Bisector | undefined;

  @observable public activeGistAction: GistActionState = GistActionState.none;
  @observable public isRunning = false;
  @observable public isAutoBisecting = false;
  @observable public isInstallingModules = false;
  @observable public isUpdatingElectronVersions = false;
  @observable public isQuitting = false;

  // -- Various "isShowing" settings ------------------
  @observable public isAddVersionDialogShowing = false;
  @observable public isBisectCommandShowing: boolean;
  @observable public isBisectDialogShowing = false;
  @observable public isConsoleShowing = false;
  @observable public isGenericDialogShowing = false;
  @observable public isSettingsShowing = false;
  @observable public isThemeDialogShowing = false;
  @observable public isTokenDialogShowing = false;
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
    const oldest = getOldestSupportedMajor();

    const filter = (ver: RunnableVersion) =>
      ver &&
      (showUndownloadedVersions ||
        ver.state === VersionState.unzipping ||
        ver.state === VersionState.ready) &&
      (showObsoleteVersions ||
        !oldest ||
        oldest <= Number.parseInt(ver.version)) &&
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
      this.addNewVersions(
        (await fetchVersions())
          .filter((ver) => !(ver.version in this.versions))
          .map((ver) => makeRunnable(ver)),
      );
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
    window.ElectronFiddle.app.loadTheme(this.theme);
  }

  @action public addLocalVersion(input: Version) {
    addLocalVersion(input);
    this.addNewVersions(getElectronVersions());
  }

  @action public addNewVersions(versions: RunnableVersion[]) {
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
    const { version, state, source } = ver;

    if (ver === this.currentElectronVersion) {
      console.log(`State: Not removing active version ${version}`);
      return;
    }

    console.log(`State: Removing Electron ${version}`);
    if (source === VersionSource.local) {
      if (version in this.versions) {
        delete this.versions[version];
        saveLocalVersions(Object.values(this.versions));
      } else {
        console.log(`State: Version ${version} already removed, doing nothing`);
      }
    } else {
      if (state === VersionState.ready) {
        await removeBinary(ver);
      } else {
        console.log(`State: Version ${version} already removed, doing nothing`);
      }
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
   * Private setVersion() helper to test if setVersion(input) would work.
   *
   * Returns a RunnableVersion if it would work, or an error string otherwise.
   */
  private isVersionUsable(
    input: string,
  ): { ver?: RunnableVersion; err?: string } {
    const ver = this.getVersion(input);
    if (!ver) {
      return { err: `Unknown version ${input}` };
    }

    const { localPath, version } = ver;
    if (localPath && !fs.existsSync(localPath)) {
      const err = `Local Electron build missing for version ${version} - please verify it is in the correct location or remove and re-add it.`;
      return { err };
    }

    return { ver };
  }

  /*
   * Private setVersion() helper to find a usable fallback version.
   */
  private findUsableVersion(): RunnableVersion | undefined {
    return this.versionsToShow.find((ver) => this.isVersionUsable(ver.version));
  }

  /**
   * Select a version of Electron (and download it if necessary).
   *
   * @param {string} input
   * @returns {Promise<void>}
   */
  @action public async setVersion(input: string) {
    // make sure we can  use this version
    const { err, ver } = this.isVersionUsable(input);
    if (!ver) {
      console.warn(`setVersion('${input}') failed: ${err}`);
      this.showErrorDialog(err!);
      const fallback = this.findUsableVersion();
      if (fallback) await this.setVersion(fallback.version);
      return;
    }

    const { version } = ver;
    console.log(`State: Switching to Electron ${version}`);
    this.version = version;

    // If there's no current fiddle,
    // or if the current fiddle is the previous version's template,
    // then load the new version's template.
    const shouldReplace = () =>
      this.editorMosaic.files.size === 0 || // no current fiddle
      (this.templateName && !this.editorMosaic.isEdited); // unedited template
    if (shouldReplace()) {
      const options: SetFiddleOptions = { templateName: version };
      const values = await getTemplate(version);
      // test again just in case something happened while we awaited
      if (shouldReplace()) {
        await window.ElectronFiddle.app.replaceFiddle(values, options);
      }
    }

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

  @action public async showGenericDialog(
    opts: GenericDialogOptions,
  ): Promise<{ confirm: boolean; input: string }> {
    this.genericDialogLastResult = null;
    this.genericDialogOptions = opts;
    this.isGenericDialogShowing = true;
    await when(() => !this.isGenericDialogShowing);
    return {
      confirm: Boolean(this.genericDialogLastResult),
      input: this.genericDialogLastInput || opts.defaultInput || '',
    };
  }

  @action public async showInputDialog(opts: {
    cancel?: string;
    defaultInput?: string;
    label: string | JSX.Element;
    ok: string;
    placeholder: string;
  }): Promise<string | undefined> {
    const { confirm, input } = await this.showGenericDialog({
      ...opts,
      cancel: opts.cancel || 'Cancel',
      type: GenericDialogType.confirm,
      wantsInput: true,
    });
    return confirm ? input : undefined;
  }

  @action public async showConfirmDialog(opts: {
    cancel?: string;
    label: string | JSX.Element;
    ok: string;
  }): Promise<boolean> {
    const { confirm } = await this.showGenericDialog({
      ...opts,
      cancel: opts.cancel || 'Cancel',
      wantsInput: false,
      type: GenericDialogType.confirm,
    });
    return confirm;
  }

  @action public async showInfoDialog(
    label: string | JSX.Element,
  ): Promise<void> {
    await this.showGenericDialog({
      label,
      ok: 'Close',
      type: GenericDialogType.success,
      wantsInput: false,
    });
  }

  @action public async showErrorDialog(
    label: string | JSX.Element,
  ): Promise<void> {
    await this.showGenericDialog({
      label,
      ok: 'Close',
      type: GenericDialogType.warning,
      wantsInput: false,
    });
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
      isNotPre,
      text: strData.trim(),
      timeString: this.timeFmt.format(new Date()),
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
   * Show or close secondary windows such as settings and dialogs.
   */
  @action public resetView(
    opts: {
      isAddVersionDialogShowing?: boolean;
      isBisectDialogShowing?: boolean;
      isConsoleShowing?: boolean;
      isGenericDialogShowing?: boolean;
      isSettingsShowing?: boolean;
      isThemeDialogShowing?: boolean;
      isTokenDialogShowing?: boolean;
      isTourShowing?: boolean;
    } = {},
  ) {
    this.isAddVersionDialogShowing = Boolean(opts.isAddVersionDialogShowing);
    this.isBisectDialogShowing = Boolean(opts.isBisectDialogShowing);
    this.isConsoleShowing = Boolean(opts.isConsoleShowing);
    this.isGenericDialogShowing = Boolean(opts.isGenericDialogShowing);
    this.isSettingsShowing = Boolean(opts.isSettingsShowing);
    this.isThemeDialogShowing = Boolean(opts.isThemeDialogShowing);
    this.isTokenDialogShowing = Boolean(opts.isTokenDialogShowing);
    this.isTourShowing = Boolean(opts.isTourShowing);
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
