import {
  BaseVersions,
  Installer,
  ProgressObject,
  Runner,
} from '@electron/fiddle-core';
import * as fs from 'fs-extra';
import {
  action,
  autorun,
  computed,
  makeObservable,
  observable,
  runInAction,
  when,
} from 'mobx';

import {
  BlockableAccelerator,
  ElectronReleaseChannel,
  GenericDialogOptions,
  GenericDialogType,
  GistActionState,
  GlobalSetting,
  GlobalSettingKey,
  IPackageManager,
  InstallState,
  OutputEntry,
  OutputOptions,
  RunnableVersion,
  SetFiddleOptions,
  Version,
  VersionSource,
  WindowSpecificSetting,
  WindowSpecificSettingKey,
} from '../interfaces';
import { Bisector } from './bisect';
import { ELECTRON_DOWNLOAD_PATH, ELECTRON_INSTALL_PATH } from './constants';
import { EditorMosaic } from './editor-mosaic';
import { ELECTRON_MIRROR } from './mirror-constants';
import { normalizeVersion } from './utils/normalize-version';
import { sortVersions } from './utils/sort-versions';
import {
  addLocalVersion,
  fetchVersions,
  getDefaultVersion,
  getElectronVersions,
  getReleaseChannel,
  makeRunnable,
  saveLocalVersions,
} from './versions';

class UpdateableBaseVersions extends BaseVersions {
  public updateVersions(val: unknown): void {
    this.setVersions(val);
  }
}

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

  private settingKeyTypeGuard(key: never): never {
    throw new Error(
      `Unhandled setting ${key}, please handle it in the \`AppState\`.`,
    );
  }

  // -- Persisted settings ------------------
  public theme: string | null = localStorage.getItem(GlobalSetting.theme);
  public gitHubAvatarUrl: string | null = localStorage.getItem(
    GlobalSetting.gitHubAvatarUrl,
  );
  public gitHubName: string | null = localStorage.getItem(
    GlobalSetting.gitHubName,
  );
  public gitHubLogin: string | null = localStorage.getItem(
    GlobalSetting.gitHubLogin,
  );
  public gitHubToken: string | null =
    localStorage.getItem(GlobalSetting.gitHubToken) || null;
  public gitHubPublishAsPublic = !!this.retrieve(
    WindowSpecificSetting.gitHubPublishAsPublic,
  );
  public channelsToShow: Array<ElectronReleaseChannel> = (this.retrieve(
    GlobalSetting.channelsToShow,
  ) as Array<ElectronReleaseChannel>) || [
    ElectronReleaseChannel.stable,
    ElectronReleaseChannel.beta,
  ];
  public showObsoleteVersions = !!(
    this.retrieve(GlobalSetting.showObsoleteVersions) ?? false
  );
  public showUndownloadedVersions = !!(
    this.retrieve(GlobalSetting.showUndownloadedVersions) ?? true
  );
  public isKeepingUserDataDirs = !!this.retrieve(
    GlobalSetting.isKeepingUserDataDirs,
  );
  public isEnablingElectronLogging = !!this.retrieve(
    GlobalSetting.isEnablingElectronLogging,
  );
  public isClearingConsoleOnRun = !!this.retrieve(
    GlobalSetting.isClearingConsoleOnRun,
  );
  public isUsingSystemTheme = !!(
    this.retrieve(GlobalSetting.isUsingSystemTheme) ?? true
  );
  public isPublishingGistAsRevision = !!(
    this.retrieve(GlobalSetting.isPublishingGistAsRevision) ?? true
  );
  public executionFlags: Array<string> =
    (this.retrieve(GlobalSetting.executionFlags) as Array<string>) === null
      ? []
      : (this.retrieve(GlobalSetting.executionFlags) as Array<string>);
  public environmentVariables: Array<string> =
    (this.retrieve(GlobalSetting.environmentVariables) as Array<string>) ===
    null
      ? []
      : (this.retrieve(GlobalSetting.environmentVariables) as Array<string>);
  public packageManager: IPackageManager =
    (localStorage.getItem(GlobalSetting.packageManager) as IPackageManager) ||
    'npm';
  public acceleratorsToBlock: Array<BlockableAccelerator> =
    (this.retrieve(
      GlobalSetting.acceleratorsToBlock,
    ) as Array<BlockableAccelerator>) || [];
  public packageAuthor =
    (localStorage.getItem(GlobalSetting.packageAuthor) as string) ??
    window.ElectronFiddle.getUsername();
  public electronMirror: typeof ELECTRON_MIRROR =
    (this.retrieve(GlobalSetting.electronMirror) as typeof ELECTRON_MIRROR) ===
    null
      ? {
          ...ELECTRON_MIRROR,
          sourceType: navigator.language === 'zh-CN' ? 'CHINA' : 'DEFAULT',
        }
      : (this.retrieve(GlobalSetting.electronMirror) as typeof ELECTRON_MIRROR);
  public fontFamily: string | undefined =
    (localStorage.getItem(GlobalSetting.fontFamily) as string) || undefined;
  public fontSize: number | undefined =
    parseInt(localStorage.getItem(GlobalSetting.fontSize)!) || undefined;

  // -- Various session-only state ------------------
  public gistId: string | undefined = undefined;
  public readonly versions: Record<string, RunnableVersion> = {};
  public version = '';
  public output: Array<OutputEntry> = [];
  public localPath: string | undefined = undefined;
  public genericDialogOptions: GenericDialogOptions = {
    type: GenericDialogType.warning,
    label: '' as string | JSX.Element,
    ok: 'Okay',
    cancel: 'Cancel',
    wantsInput: false,
    placeholder: '',
  };
  public readonly editorMosaic = new EditorMosaic();
  public genericDialogLastResult: boolean | null = null;
  public genericDialogLastInput: string | null = null;
  public templateName: string | undefined = undefined;
  public Bisector: Bisector | undefined = undefined;
  public modules: Map<string, string> = new Map();

  public activeGistAction: GistActionState = GistActionState.none;

  // -- Various "isShowing" settings ------------------
  public isAddVersionDialogShowing = false;
  public isAutoBisecting = false;
  public isBisectCommandShowing = false;
  public isBisectDialogShowing = false;
  public isConsoleShowing = false;
  public isGenericDialogShowing = false;
  public isInstallingModules = false;
  public isOnline = navigator.onLine;
  public isQuitting = false;
  public isRunning = false;
  public isSettingsShowing = false;
  public isThemeDialogShowing = false;
  public isTokenDialogShowing = false;
  public isTourShowing = !localStorage.getItem(GlobalSetting.hasShownTour);
  public isUpdatingElectronVersions = false;

  // -- Editor Values stored when we close the editor ------------------
  private outputBuffer = '';
  private name: string;
  private readonly defaultVersion: string;
  public appData: string;

  // Populating versions in fiddle-core
  public baseVersions = new UpdateableBaseVersions(getElectronVersions());

  // For managing downloads and versions for electron
  public installer: Installer = new Installer({
    electronDownloads: ELECTRON_DOWNLOAD_PATH,
    electronInstall: ELECTRON_INSTALL_PATH,
  });

  public versionRunner: Promise<Runner> = Runner.create({
    installer: this.installer,
    versions: this.baseVersions,
  });

  constructor(versions: RunnableVersion[]) {
    makeObservable<AppState, 'setPageHash'>(this, {
      Bisector: observable,
      acceleratorsToBlock: observable,
      activeGistAction: observable,
      addAcceleratorToBlock: action,
      addLocalVersion: action,
      addNewVersions: action,
      channelsToShow: observable,
      clearConsole: action,
      currentElectronVersion: computed,
      disableTour: action,
      downloadVersion: action,
      editorMosaic: observable,
      electronMirror: observable,
      environmentVariables: observable,
      executionFlags: observable,
      flushOutput: action,
      fontFamily: observable,
      fontSize: observable,
      genericDialogLastInput: observable,
      genericDialogLastResult: observable,
      genericDialogOptions: observable,
      gistId: observable,
      gitHubAvatarUrl: observable,
      gitHubLogin: observable,
      gitHubName: observable,
      gitHubPublishAsPublic: observable,
      gitHubToken: observable,
      hideChannels: action,
      isAddVersionDialogShowing: observable,
      isAutoBisecting: observable,
      isBisectCommandShowing: observable,
      isBisectDialogShowing: observable,
      isClearingConsoleOnRun: observable,
      isConsoleShowing: observable,
      isEnablingElectronLogging: observable,
      isGenericDialogShowing: observable,
      isInstallingModules: observable,
      isKeepingUserDataDirs: observable,
      isOnline: observable,
      isPublishingGistAsRevision: observable,
      isQuitting: observable,
      isRunning: observable,
      isSettingsShowing: observable,
      isThemeDialogShowing: observable,
      isTokenDialogShowing: observable,
      isTourShowing: observable,
      isUpdatingElectronVersions: observable,
      isUsingSystemTheme: observable,
      localPath: observable,
      modules: observable,
      output: observable,
      packageAuthor: observable,
      packageManager: observable,
      pushError: action,
      pushOutput: action,
      removeAcceleratorToBlock: action,
      removeVersion: action,
      resetView: action,
      setIsQuitting: action,
      setPageHash: action,
      setTheme: action,
      setVersion: action,
      showChannels: action,
      showConfirmDialog: action,
      showErrorDialog: action,
      showGenericDialog: action,
      showInfoDialog: action,
      showInputDialog: action,
      showObsoleteVersions: observable,
      showTour: action,
      showUndownloadedVersions: observable,
      signOutGitHub: action,
      templateName: observable,
      theme: observable,
      title: computed,
      toggleAddMonacoThemeDialog: action,
      toggleAddVersionDialog: action,
      toggleAuthDialog: action,
      toggleBisectCommands: action,
      toggleBisectDialog: action,
      toggleConsole: action,
      toggleSettings: action,
      updateElectronVersions: action,
      version: observable,
      versions: observable,
      versionsToShow: computed,
      changeRunnableState: action,
    });

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
    this.addAcceleratorToBlock = this.addAcceleratorToBlock.bind(this);
    this.removeAcceleratorToBlock = this.removeAcceleratorToBlock.bind(this);
    this.hideChannels = this.hideChannels.bind(this);
    this.showChannels = this.showChannels.bind(this);
    this.changeRunnableState = this.changeRunnableState.bind(this);

    // Populating the current state of every version present
    versions.forEach((ver: RunnableVersion) => {
      // A local electron build's `state` is setup in versions.ts
      if (ver.source !== 'local') {
        const { version } = ver;
        ver.state = this.getVersionState(version);
      }
    });

    // init fields
    this.versions = Object.fromEntries(versions.map((v) => [v.version, v]));
    this.defaultVersion = getDefaultVersion(versions);
    this.version = this.defaultVersion;

    window.ElectronFiddle.removeAllListeners('before-quit');
    window.ElectronFiddle.removeAllListeners('toggle-bisect');
    window.ElectronFiddle.removeAllListeners('clear-console');
    window.ElectronFiddle.removeAllListeners('open-settings');
    window.ElectronFiddle.removeAllListeners('show-welcome-tour');

    window.ElectronFiddle.addEventListener(
      'open-settings',
      this.toggleSettings,
    );
    window.ElectronFiddle.addEventListener('show-welcome-tour', this.showTour);
    window.ElectronFiddle.addEventListener('clear-console', this.clearConsole);
    window.ElectronFiddle.addEventListener(
      'toggle-bisect',
      this.toggleBisectCommands,
    );
    window.ElectronFiddle.addEventListener('before-quit', this.setIsQuitting);

    /**
     * Listens for changes in the app settings made in other windows
     * and refreshes the current window settings accordingly.
     */
    window.addEventListener('storage', (event) => {
      const key = event.key as GlobalSettingKey;
      const { newValue } = event;

      let parsedValue: unknown;

      try {
        parsedValue = JSON.parse(newValue as string) as unknown;
      } catch {
        // The new value is a plain string, not a well-formed stringified object.
        parsedValue = newValue;
      }

      if (key in GlobalSetting && key in this) {
        switch (key) {
          case 'theme': {
            this.setTheme(parsedValue as string);
            break;
          }

          case 'acceleratorsToBlock':
          case 'channelsToShow':
          case 'electronMirror':
          case 'environmentVariables':
          case 'executionFlags':
          case 'fontFamily':
          case 'fontSize':
          case 'gitHubAvatarUrl':
          case 'gitHubLogin':
          case 'gitHubName':
          case 'gitHubToken':
          case 'hasShownTour':
          case 'isClearingConsoleOnRun':
          case 'isEnablingElectronLogging':
          case 'isKeepingUserDataDirs':
          case 'isPublishingGistAsRevision':
          case 'isUsingSystemTheme':
          case 'knownVersion':
          case 'localVersion':
          case 'packageAuthor':
          case 'packageManager':
          case 'showObsoleteVersions':
          case 'showUndownloadedVersions': {
            // Fall back to updating the state.
            this[key] = parsedValue;
            break;
          }

          default: {
            this.settingKeyTypeGuard(key);
          }
        }
      } else {
        console.warn(
          `"${key}" is not a recognized localStorage key. If you're using this key to persist a setting, please add it to the relevant enum.`,
        );
      }
    });

    // Setup auto-runs
    autorun(() => this.save(GlobalSetting.theme, this.theme));
    autorun(() =>
      this.save(
        GlobalSetting.isClearingConsoleOnRun,
        this.isClearingConsoleOnRun,
      ),
    );
    autorun(() =>
      this.save(GlobalSetting.isUsingSystemTheme, this.isUsingSystemTheme),
    );
    autorun(() =>
      this.save(
        GlobalSetting.isPublishingGistAsRevision,
        this.isPublishingGistAsRevision,
      ),
    );
    autorun(() =>
      this.save(GlobalSetting.gitHubAvatarUrl, this.gitHubAvatarUrl),
    );
    autorun(() => this.save(GlobalSetting.gitHubLogin, this.gitHubLogin));
    autorun(() => this.save(GlobalSetting.gitHubName, this.gitHubName));
    autorun(() => this.save(GlobalSetting.gitHubToken, this.gitHubToken));
    autorun(() =>
      this.save(
        WindowSpecificSetting.gitHubPublishAsPublic,
        this.gitHubPublishAsPublic,
      ),
    );
    autorun(() =>
      this.save(
        GlobalSetting.isKeepingUserDataDirs,
        this.isKeepingUserDataDirs,
      ),
    );
    autorun(() =>
      this.save(
        GlobalSetting.isEnablingElectronLogging,
        this.isEnablingElectronLogging,
      ),
    );
    autorun(() => this.save(GlobalSetting.executionFlags, this.executionFlags));
    autorun(() =>
      this.save(GlobalSetting.environmentVariables, this.environmentVariables),
    );
    autorun(() => this.save(WindowSpecificSetting.version, this.version));
    autorun(() => this.save(GlobalSetting.channelsToShow, this.channelsToShow));
    autorun(() =>
      this.save(
        GlobalSetting.showUndownloadedVersions,
        this.showUndownloadedVersions,
      ),
    );
    autorun(() =>
      this.save(GlobalSetting.showObsoleteVersions, this.showObsoleteVersions),
    );
    autorun(() =>
      this.save(GlobalSetting.packageManager, this.packageManager ?? 'npm'),
    );
    autorun(() =>
      this.save(GlobalSetting.acceleratorsToBlock, this.acceleratorsToBlock),
    );
    autorun(() => this.save(GlobalSetting.packageAuthor, this.packageAuthor));
    autorun(() => this.save(GlobalSetting.electronMirror, this.electronMirror));
    autorun(() => this.save(GlobalSetting.fontFamily, this.fontFamily));
    autorun(() => this.save(GlobalSetting.fontSize, this.fontSize));

    // Update our known versions
    this.updateElectronVersions();

    // Make sure the console isn't all empty and sad
    this.pushOutput('Console ready 🔬');

    // set blocked shortcuts
    window.ElectronFiddle.blockAccelerators([...this.acceleratorsToBlock]);

    this.setVersion(this.version);

    // Trigger the change state event
    this.installer.on('state-changed', ({ version, state }) => {
      this.changeRunnableState(version, state);
    });
  }

  /**
   * @returns {string} the title, e.g. appname, fiddle name, state
   */
  get title(): string {
    const { isEdited } = this.editorMosaic;

    return isEdited ? 'Electron Fiddle - Unsaved' : 'Electron Fiddle';
  }

  /**
   * Returns the current RunnableVersion or the first
   * one that can be found.
   */
  get currentElectronVersion(): RunnableVersion {
    return this.versions[this.version] || this.versions[this.defaultVersion];
  }

  /**
   * Returns an array of Electron versions to show given the
   * current settings for states and channels to display
   */
  get versionsToShow(): Array<RunnableVersion> {
    const {
      channelsToShow,
      showObsoleteVersions,
      showUndownloadedVersions,
      versions,
    } = this;
    const oldest = window.ElectronFiddle.getOldestSupportedMajor();

    const filter = (ver: RunnableVersion) =>
      ver &&
      (showUndownloadedVersions ||
        ver.state === InstallState.installing ||
        ver.state === InstallState.installed ||
        ver.state === InstallState.downloaded) &&
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
  public async updateElectronVersions() {
    this.isUpdatingElectronVersions = true;

    try {
      const fullVersions = await fetchVersions();
      this.addNewVersions(
        fullVersions
          .filter((ver) => !(ver.version in this.versions))
          .map((ver) => makeRunnable(ver)),
      );
      this.baseVersions.updateVersions(fullVersions);
    } catch (error) {
      console.warn(`State: Could not update Electron versions`, error);
    }

    this.isUpdatingElectronVersions = false;
  }

  public async getName() {
    this.name ||= await window.ElectronFiddle.getProjectName(this.localPath);
    return this.name;
  }

  public hideChannels(channels: Array<ElectronReleaseChannel>) {
    this.channelsToShow = this.channelsToShow.filter(
      (ch) => !channels.includes(ch),
    );
  }

  public showChannels(channels: Array<ElectronReleaseChannel>) {
    const s = new Set<ElectronReleaseChannel>([
      ...this.channelsToShow,
      ...channels,
    ]);
    this.channelsToShow = [...s.values()];
  }

  public toggleConsole() {
    this.isConsoleShowing = !this.isConsoleShowing;
  }

  public clearConsole() {
    this.output = [];
  }

  public toggleBisectCommands() {
    // guard against hiding the commands when executing a bisect
    if (!this.Bisector && !this.isBisectDialogShowing) {
      this.isBisectCommandShowing = !this.isBisectCommandShowing;
    }
  }

  public toggleAddVersionDialog() {
    this.isAddVersionDialogShowing = !this.isAddVersionDialogShowing;
  }

  public toggleAddMonacoThemeDialog() {
    this.isThemeDialogShowing = !this.isThemeDialogShowing;
  }

  public toggleAuthDialog() {
    this.isTokenDialogShowing = !this.isTokenDialogShowing;
  }

  public toggleBisectDialog() {
    this.isBisectDialogShowing = !this.isBisectDialogShowing;
  }

  public toggleSettings() {
    // We usually don't lose editor focus,
    // so you can still type. Let's force-blur.
    (document.activeElement as HTMLInputElement).blur();

    this.resetView({ isSettingsShowing: !this.isSettingsShowing });
  }

  public setIsQuitting() {
    this.isQuitting = true;
  }

  public disableTour() {
    this.resetView();
    localStorage.setItem(GlobalSetting.hasShownTour, 'true');
  }

  public showTour() {
    this.resetView({ isTourShowing: true });
  }

  public setTheme(fileName?: string) {
    this.theme = fileName || '';
    window.ElectronFiddle.app.loadTheme(this.theme);
  }

  public addLocalVersion(input: Version) {
    addLocalVersion(input);
    this.addNewVersions(getElectronVersions());
  }

  public addNewVersions(versions: RunnableVersion[]) {
    for (const ver of versions) {
      this.versions[ver.version] ||= ver;
    }
  }

  /**
   * Remove a version of Electron
   *
   * @param {RunnableVersion} ver
   * @returns {Promise<void>}
   */
  public async removeVersion(ver: RunnableVersion): Promise<void> {
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
      if (
        state === InstallState.installed ||
        state == InstallState.downloaded
      ) {
        await this.installer.remove(version);
        if (this.installer.state(version) === InstallState.missing) {
          const typeDefsCleaner = async () => {
            window.ElectronFiddle.app.electronTypes.uncache(ver);
          };

          await typeDefsCleaner();
        }
      } else {
        console.log(`State: Version ${version} already removed, doing nothing`);
      }
    }
  }

  /**
   * Download a version of Electron.
   *
   * @param {RunnableVersion} ver
   * @returns {Promise<void>}
   */
  public async downloadVersion(ver: RunnableVersion): Promise<void> {
    const { source, state, version } = ver;
    const {
      electronMirror,
      electronNightlyMirror,
    } = this.electronMirror.sources[this.electronMirror.sourceType];

    const isRemote = source === VersionSource.remote;
    const isDownloaded = state === InstallState.downloaded;
    const isDownloading = state === InstallState.downloading;
    const isInstalling = state === InstallState.installing;
    const isReady = state === InstallState.installed;

    if (isDownloaded || isDownloading || isInstalling) {
      console.log(`State: Already ${state} ${version}.`);
      return;
    }

    if (!isRemote || isReady) {
      console.log(`State: Already have version ${version}; not downloading.`);
      return;
    }

    console.log(`State: Downloading Electron ${version}`);

    // Download the version without setting it as the current version.
    await this.installer.ensureDownloaded(version, {
      mirror: {
        electronMirror,
        electronNightlyMirror,
      },
      progressCallback(progress: ProgressObject) {
        // https://mobx.js.org/actions.html#runinaction
        runInAction(() => {
          const percent = Math.round(progress.percent * 100) / 100;
          if (ver.downloadProgress !== percent) {
            ver.downloadProgress = percent;
          }
        });
      },
    });
  }

  /**
   * Changes the RunnableVersion state of the version passed
   * and triggers a rerun in components
   */
  public changeRunnableState(version: string, state: InstallState) {
    const ver = this.versions[version];
    if (ver === undefined) {
      return;
    }
    ver.state = state;
    this.versions[version] = ver;
  }

  public hasVersion(input: string): boolean {
    return !!this.getVersion(input);
  }

  public getVersion(input: string): RunnableVersion | null {
    return this.versions[normalizeVersion(input)];
  }

  /**
   * Helper to test if the current version is available and would work.
   *
   * Returns a RunnableVersion if it would work, or an error string otherwise.
   */
  public isVersionUsable(
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

  /**
   * Helper to find a usable fallback version.
   */
  public findUsableVersion(): RunnableVersion | undefined {
    return this.versionsToShow.find((version) => {
      const { ver } = this.isVersionUsable(version.version);
      return !!ver;
    });
  }

  /**
   * Select a version of Electron (and download it if necessary).
   *
   * @param {string} input
   * @returns {Promise<void>}
   */
  public async setVersion(input: string): Promise<void> {
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
      const values = await window.ElectronFiddle.getTemplate(version);
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
  public signOutGitHub(): void {
    this.gitHubAvatarUrl = null;
    this.gitHubLogin = null;
    this.gitHubToken = null;
    this.gitHubName = null;
  }

  public async showGenericDialog(
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

  public async showInputDialog(opts: {
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

  public showConfirmDialog = async (opts: {
    cancel?: string;
    label: string | JSX.Element;
    ok: string;
  }): Promise<boolean> => {
    const { confirm } = await this.showGenericDialog({
      ...opts,
      cancel: opts.cancel || 'Cancel',
      wantsInput: false,
      type: GenericDialogType.confirm,
    });
    return confirm;
  };

  public async showInfoDialog(label: string | JSX.Element): Promise<void> {
    await this.showGenericDialog({
      label,
      ok: 'Close',
      type: GenericDialogType.success,
      wantsInput: false,
    });
  }

  public async showErrorDialog(label: string | JSX.Element): Promise<void> {
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
  public flushOutput(): void {
    this.pushOutput('\n', { bypassBuffer: false });
  }

  /**
   * Push output to the application's state. Accepts a buffer or a string as input,
   * attaches a timestamp, and pushes into the store.
   *
   * @param {(string | Buffer)} data
   * @param {OutputOptions} options
   */
  public pushOutput(
    data: string | Buffer,
    options: OutputOptions = { isNotPre: false, bypassBuffer: true },
  ) {
    let strData = data.toString();
    const { isNotPre, bypassBuffer } = options;

    if (window.ElectronFiddle.platform === 'win32' && bypassBuffer === false) {
      this.outputBuffer += strData;
      strData = this.outputBuffer;
      const parts = strData.split(/\r?\n/);
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
    if (strData === 'For help, see: https://nodejs.org/en/docs/inspector')
      return;

    const entry: OutputEntry = {
      isNotPre,
      text: strData.trim(),
      timeString: this.timeFmt.format(new Date()),
    };
    window.ElectronFiddle.pushOutputEntry(entry);
    this.output.push(entry);
  }

  /**
   * Little convenience method that pushes message and error.
   *
   * @param {string} message
   * @param {Error} error
   */
  public pushError(message: string, error: Error) {
    this.pushOutput(`⚠️ ${message}. Error encountered:`);
    this.pushOutput(error.toString());
    console.warn(error);
  }

  public async addAcceleratorToBlock(acc: BlockableAccelerator) {
    if (!this.acceleratorsToBlock.includes(acc)) {
      this.acceleratorsToBlock = [...this.acceleratorsToBlock, acc];
      window.ElectronFiddle.blockAccelerators([...this.acceleratorsToBlock]);
    }
  }

  public async removeAcceleratorToBlock(acc: BlockableAccelerator) {
    if (this.acceleratorsToBlock.includes(acc)) {
      this.acceleratorsToBlock = this.acceleratorsToBlock.filter(
        (a) => a !== acc,
      );
      window.ElectronFiddle.blockAccelerators([...this.acceleratorsToBlock]);
    }
  }

  /**
   * Show or close secondary windows such as settings and dialogs.
   */
  public resetView(
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
  private setPageHash() {
    let hash = '';

    if (this.isSettingsShowing) {
      hash = 'settings';
    }

    window.location.hash = hash;
  }

  /**
   * Returns the current state of version passed
   *
   * @param {string} version
   * @returns {InstallState}
   */
  public getVersionState(version: string): InstallState {
    return this.installer.state(version);
  }

  /**
   * Save a key/value to localStorage.
   *
   * @param {string} key
   * @param {(string | number | Array<any> | Record<string, unknown> | null | boolean)} [value]
   */
  private save(
    key: GlobalSettingKey | WindowSpecificSettingKey,
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
  private retrieve<T>(
    key: GlobalSettingKey | WindowSpecificSettingKey,
  ): T | string | null {
    const value = localStorage.getItem(key);

    return JSON.parse(value || 'null') as T;
  }
}
