import * as fsType from 'fs-extra';
import { action, autorun, computed, observable, when } from 'mobx';
import { MosaicNode } from 'react-mosaic-component';

import {
  ALL_MOSAICS,
  DocsDemoPage,
  EditorId,
  GenericDialogOptions,
  GenericDialogType,
  MosaicId,
  OutputEntry,
  OutputOptions,
  RunnableVersion,
  Version,
  VersionSource,
  VersionState
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { arrayToStringMap } from '../utils/array-to-stringmap';
import { EditorBackup, getEditorBackup } from '../utils/editor-backup';
import { createMosaicArrangement, getVisibleMosaics } from '../utils/editors-mosaic-arrangement';
import { getName } from '../utils/get-title';
import { fancyImport } from '../utils/import';
import { normalizeVersion } from '../utils/normalize-version';
import { isEditorBackup, isEditorId, isPanelId } from '../utils/type-checks';
import { getDownloadedVersions, getDownloadingVersions, removeBinary, setupBinary } from './binary';
import { Bisector } from './bisect';
import { DEFAULT_CLOSED_PANELS, DEFAULT_MOSAIC_ARRANGEMENT } from './constants';
import { getContent, isContentUnchanged } from './content';
import { getLocalTypePathForVersion, updateEditorTypeDefinitions } from './fetch-types';
import { ipcRendererManager } from './ipc';
import { activateTheme } from './themes';

import { sortedElectronMap } from '../utils/sorted-electron-map';
import {
  addLocalVersion,
  ElectronReleaseChannel,
  getDefaultVersion,
  getElectronVersions,
  getReleaseChannel,
  getUpdatedElectronVersions,
  saveLocalVersions
} from './versions';

const knownVersions = getElectronVersions();
const defaultVersion = getDefaultVersion(knownVersions);

/**
 * Editors exist outside of React's world. To make things *a lot*
 * easier, we keep them around in a global object. Don't judge us,
 * we're really only doing that for the editors.
 */
window.ElectronFiddle = window.ElectronFiddle || {
  editors: {
    main: null,
    renderer: null,
    html: null
  },
  app: null
} as any;

/**
 * The application's state. Exported as a singleton below.
 *
 * @export
 * @class AppState
 */
export class AppState {
  // -- Persisted settings ------------------
  @observable public version: string = defaultVersion;
  @observable public theme: string | null = localStorage.getItem('theme');
  @observable public gitHubAvatarUrl: string | null = localStorage.getItem('gitHubAvatarUrl');
  @observable public gitHubName: string | null = localStorage.getItem('gitHubName');
  @observable public gitHubLogin: string | null = localStorage.getItem('gitHubLogin');
  @observable public gitHubToken: string | null = localStorage.getItem('gitHubToken') || null;
  @observable public gitHubPublishAsPublic: boolean = !!this.retrieve('gitHubPublishAsPublic');
  @observable public channelsToShow: Array<ElectronReleaseChannel> =
    this.retrieve('channelsToShow') as Array<ElectronReleaseChannel>
    || [ElectronReleaseChannel.stable, ElectronReleaseChannel.beta];
  @observable public statesToShow: Array<VersionState> =
    this.retrieve('statesToShow') as Array<VersionState>
    || [VersionState.downloading, VersionState.ready, VersionState.unknown];
  @observable public isKeepingUserDataDirs: boolean = !!this.retrieve('isKeepingUserDataDirs');
  @observable public isEnablingElectronLogging: boolean = !!this.retrieve('isEnablingElectronLogging');
  @observable public isClearingConsoleOnRun: boolean = !!this.retrieve('isClearingConsoleOnRun');
  @observable public executionFlags: Array<string> =
    this.retrieve('executionFlags') as Array<string> === null ?
      [] : this.retrieve('executionFlags') as Array<string>;

  // -- Various session-only state ------------------
  @observable public gistId: string = '';
  @observable public versions: Record<string, RunnableVersion> = arrayToStringMap(knownVersions);
  @observable public output: Array<OutputEntry> = [];
  @observable public localPath: string | undefined;
  @observable public genericDialogOptions = { type: GenericDialogType.warning, label: '', ok: 'Okay', cancel: 'Cancel' };
  @observable public genericDialogLastResult: boolean | null = null;
  @observable public mosaicArrangement: MosaicNode<MosaicId> | null = DEFAULT_MOSAIC_ARRANGEMENT;
  @observable public templateName: string | undefined;
  @observable public currentDocsDemoPage: DocsDemoPage = DocsDemoPage.DEFAULT;
  @observable public localTypeWatcher: fsType.FSWatcher | undefined;
  @observable public Bisector: Bisector | undefined;

  @observable public isPublishing: boolean = false;
  @observable public isRunning: boolean = false;
  @observable public isUnsaved: boolean;
  @observable public isUpdatingElectronVersions: boolean = false;

  // -- Various "isShowing" settings ------------------
  @observable public isBisectCommandShowing: boolean;
  @observable public isConsoleShowing: boolean = false;
  @observable public isTokenDialogShowing: boolean = false;
  @observable public isGenericDialogShowing: boolean = false;
  @observable public isSettingsShowing: boolean = false;
  @observable public isBisectDialogShowing: boolean = false;
  @observable public isAddVersionDialogShowing: boolean = false;
  @observable public isThemeDialogShowing: boolean = false;
  @observable public isTourShowing: boolean = !localStorage.getItem('hasShownTour');

  // -- Editor Values stored when we close the editor ------------------
  @observable public closedPanels: Partial<Record<MosaicId, EditorBackup | true>> = DEFAULT_CLOSED_PANELS;

  private outputBuffer: string = '';
  private name: string;

  constructor() {
    // Bind all actions
    this.downloadVersion = this.downloadVersion.bind(this);
    this.pushError = this.pushError.bind(this);
    this.pushOutput = this.pushOutput.bind(this);
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
    this.resetEditorLayout = this.resetEditorLayout.bind(this);

    ipcRendererManager.removeAllListeners(IpcEvents.OPEN_SETTINGS);
    ipcRendererManager.removeAllListeners(IpcEvents.SHOW_WELCOME_TOUR);
    ipcRendererManager.removeAllListeners(IpcEvents.CLEAR_CONSOLE);
    ipcRendererManager.removeAllListeners(IpcEvents.BISECT_COMMANDS_TOGGLE);

    ipcRendererManager.on(IpcEvents.OPEN_SETTINGS, this.toggleSettings);
    ipcRendererManager.on(IpcEvents.SHOW_WELCOME_TOUR, this.showTour);
    ipcRendererManager.on(IpcEvents.CLEAR_CONSOLE, this.clearConsole);
    ipcRendererManager.on(IpcEvents.BISECT_COMMANDS_TOGGLE, this.toggleBisectCommands);

    // Setup auto-runs
    autorun(() => this.save('theme', this.theme));
    autorun(() => this.save('isClearingConsoleOnRun', this.isClearingConsoleOnRun));
    autorun(() => this.save('gitHubAvatarUrl', this.gitHubAvatarUrl));
    autorun(() => this.save('gitHubLogin', this.gitHubLogin));
    autorun(() => this.save('gitHubName', this.gitHubName));
    autorun(() => this.save('gitHubToken', this.gitHubToken));
    autorun(() => this.save('gitHubPublishAsPublic', this.gitHubPublishAsPublic));
    autorun(() => this.save('isKeepingUserDataDirs', this.isKeepingUserDataDirs));
    autorun(() => this.save('isEnablingElectronLogging', this.isEnablingElectronLogging));
    autorun(() => this.save('executionFlags', this.executionFlags));
    autorun(() => this.save('version', this.version));
    autorun(() => this.save('channelsToShow', this.channelsToShow));
    autorun(() => this.save('statesToShow', this.statesToShow));

    autorun(() => {
      if (typeof this.isUnsaved === 'undefined') return;

      if (!!this.isUnsaved) {
        window.onbeforeunload = () => {
          ipcRendererManager.send(IpcEvents.SHOW_INACTIVE);
          this.setGenericDialogOptions({
            type: GenericDialogType.warning,
            label: `The current Fiddle is unsaved. Do you want to exit anyway?`,
            ok: 'Quit'
          });

          this.isGenericDialogShowing = true;

          // We'll wait until the warning dialog was closed
          when(() => !this.isGenericDialogShowing).then(() => {
            // The user confirmed, let's close for real.
            if (this.genericDialogLastResult) {
              window.onbeforeunload = null;

              // Should we just close or quit?
              const remote = require('electron').remote;
              const isQuitting = remote.getGlobal('isQuitting');

              if (isQuitting) {
                remote.app.quit();
              } else {
                window.close();
              }
            }
          });

          return false;
        };
      } else {
        window.onbeforeunload = null;

        // set up editor listeners to verify if unsaved
        Object.keys(window.ElectronFiddle.editors).forEach((key) => {
          const editor = window.ElectronFiddle.editors[key];
          const disposable = editor.onDidChangeModelContent(() => {
            this.isUnsaved = true;
            disposable.dispose();
          });
        });
      }
    });

    // Update our known versions
    this.updateElectronVersions();

    // Make sure the console isn't all empty and sad
    this.pushOutput('Console ready 🔬');
  }

  /**
   * Returns the current RunnableVersion or the first
   * one that can be found.
   */
  @computed get currentElectronVersion(): RunnableVersion {
    if (this.versions[this.version]) {
      return this.versions[this.version];
    } else {
      return this.versions[defaultVersion];
    }
  }

  /**
   * Returns an array of Electron versions to show given the
   * current settings for states and channels to display
   */
  @computed get versionsToShow(): Array<RunnableVersion> {
    return sortedElectronMap<RunnableVersion>(this.versions, (_key, item) => item)
      .filter((item) => {
        if (!item) {
          return false;
        }

        // Check if we want to show the version
        if (!this.channelsToShow.includes(getReleaseChannel(item))) {
          return false;
        }

        // Check if we want to show the state
        if (!this.statesToShow.includes(item.state)) {
          return false;
        }

        return true;
      });
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
      const versions = await getUpdatedElectronVersions();
      this.versions = arrayToStringMap(versions);
      await this.updateDownloadedVersionState();
    } catch (error) {
      console.warn(`State: Could not update Electron versions`, error);
    }

    this.isUpdatingElectronVersions = false;
  }

  @action public async getName() {
    if (!this.name) {
      this.name = await getName(this);
    }

    return this.name;
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
    if ((document.activeElement as HTMLInputElement).blur) {
      (document.activeElement as HTMLInputElement).blur();
    }

    this.resetView({ isSettingsShowing: !this.isSettingsShowing });
  }

  @action public disableTour() {
    this.resetView({ isTourShowing: false });
    localStorage.setItem('hasShownTour', 'true');
  }

  @action public showTour() {
    this.resetView({ isTourShowing: true });
  }

  @action public setTheme(fileName?: string) {
    this.theme = fileName || '';
    activateTheme(undefined, undefined, fileName);
    window.ElectronFiddle.app.setupTheme();
  }

  @action public setGenericDialogOptions(opts: GenericDialogOptions) {
    this.genericDialogOptions = {
      type: GenericDialogType.warning,
      ok: 'Okay',
      cancel: 'Cancel',
      ...opts
    };
  }

  @action public addLocalVersion(input: Version) {
    addLocalVersion(input);

    this.versions = arrayToStringMap(getElectronVersions());
    this.updateDownloadedVersionState();
  }

  /**
   * Remove a version of Electron
   *
   * @param {string} input
   * @returns {Promise<void>}
   */
  @action public async removeVersion(input: string) {
    const version = normalizeVersion(input);
    const release = this.versions[version];

    console.log(`State: Removing Electron ${version}`);

    // Already not present?
    if ((this.versions[version] || { state: '' }).state !== 'ready') {
      console.log(`State: Version already removed, doing nothing`);
      return;
    }

    // Update state
    const updatedVersions = { ...this.versions };

    // Actually remove
    if (release && release.source === VersionSource.local) {
      delete updatedVersions[version];

      const versionsAsArray = Object
        .keys(updatedVersions)
        .map((k) => updatedVersions[k]);

      saveLocalVersions(versionsAsArray);
    } else {
      await removeBinary(version);
      updatedVersions[version].state = VersionState.unknown;
    }

    this.versions = updatedVersions;
    this.updateDownloadedVersionState();
  }

  /**
   * Download a version of Electron.
   *
   * @param {string} input
   * @returns {Promise<void>}
   */
  @action public async downloadVersion(input: string) {
    const version = normalizeVersion(input);
    console.log(`State: Downloading Electron ${version}`);

    const release = this.versions[version] || { state: '', source: '' };
    const isLocal = release.source === VersionSource.local;
    const isReady = release.state === 'ready';

    // Fetch new binaries, maybe?
    if (!isLocal && !isReady) {
      console.log(`State: Fetching v${version}`);
      const updatedVersions = { ...this.versions };
      updatedVersions[version] = updatedVersions[version] || {};
      this.versions = updatedVersions;

      await setupBinary(this, version);
      this.updateDownloadedVersionState();
    } else {
      console.log(`State: Version ${version} already downloaded, doing nothing.`);
    }
  }

  /**
   * Select a version of Electron (and download it if necessary).
   *
   * @param {string} input
   * @returns {Promise<void>}
   */
  @action public async setVersion(input: string) {
    const version = normalizeVersion(input);

    if (!this.versions[version]) {
      console.warn(`State: Called setVersion() with ${version}, which does not exist.`);
      this.setVersion(knownVersions[0].version);

      return;
    }

    console.log(`State: Switching to Electron ${version}`);

    this.version = version;

    // Should we update the editor?
    if (await isContentUnchanged(EditorId.main)) {
      const main = await getContent(EditorId.main, version);
      window.ElectronFiddle.app.setEditorValues({ main });
    }

    // Update TypeScript definitions
    const versionObject = this.versions[version];

    if (versionObject.source === VersionSource.local) {
      const fs = await fancyImport<typeof fsType>('fs-extra');
      const typePath = getLocalTypePathForVersion(versionObject);
      console.info(`TypeDefs: Watching file for local version ${version} at path ${typePath}`);
      try {
        this.localTypeWatcher = fs.watch(typePath!, async () => {
          console.info(`TypeDefs: Noticed file change at ${typePath}. Updating editor typedefs.`);
          await updateEditorTypeDefinitions(versionObject);
        });
      } catch (err) {
        console.info('TypeDefs: Unable to start watching.');
      }
    } else {
      if (!!this.localTypeWatcher) {
        console.info(`TypeDefs: Switched to downloaded version ${version}. Unwatching local typedefs.`);
        this.localTypeWatcher.close();
        this.localTypeWatcher = undefined;
      }
    }
    await updateEditorTypeDefinitions(versionObject);

    // Fetch new binaries, maybe?
    await this.downloadVersion(version);
  }

  /**
   * Go and check which versions have already been downloaded.
   *
   * @returns {Promise<void>}
   */
  @action public async updateDownloadedVersionState(): Promise<void> {
    const updatedVersions = { ...this.versions };

    // Keep state of currently downloading binaries first
    const downloadingVersions = getDownloadingVersions(this);
    (downloadingVersions || []).forEach((version) => {
      if (updatedVersions[version]) {
        updatedVersions[version].state = VersionState.downloading;
      }
    });

    const downloadedVersions = await getDownloadedVersions();
    (downloadedVersions || []).forEach((version) => {
      if (updatedVersions[version]) {
        updatedVersions[version].state = VersionState.ready;
      }
    });

    console.log(`State: Updated version state`, updatedVersions);

    this.versions = updatedVersions;
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

  /**
   * Push output to the application's state. Accepts a buffer or a string as input,
   * attaches a timestamp, and pushes into the store.
   *
   * @param {(string | Buffer)} data
   */
  @action public pushOutput(
    data: string | Buffer, options: OutputOptions = { isNotPre: false, bypassBuffer: true }
  ) {
    let strData = data.toString();
    const { isNotPre, bypassBuffer } = options;

    // TODO: This drops the first part of the buffer... is that fully expected?
    if (process.platform === 'win32' && bypassBuffer === false) {
      this.outputBuffer += strData;
      strData = this.outputBuffer;
      const parts = strData.split('\r\n');
      for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
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

    this.output.push({
      timestamp: Date.now(),
      text: strData.trim(),
      isNotPre
    });
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

  /**
   * Sets the editor value for a given editor. Deletes the value after
   * accessing it.
   *
   * @param {EditorId} id
   */
  @action public getAndRemoveEditorValueBackup(id: EditorId): EditorBackup | null {
    const value = this.closedPanels[id];

    if (isEditorBackup(value)) {
      delete this.closedPanels[id];
      return value;
    }

    return null;
  }

  @action public async setVisibleMosaics(visible: Array<MosaicId>) {
    const currentlyVisible = getVisibleMosaics(this.mosaicArrangement);

    for (const id of ALL_MOSAICS) {
      if (!visible.includes(id) && currentlyVisible.includes(id)) {
        this.closedPanels[id] = isEditorId(id)
          ? getEditorBackup(id)
          : true;

        // if we have backup, remove active editor
        delete window.ElectronFiddle.editors[id];
      }

      // Remove the backup for panels now. Editors will remove their
      // backup once the data has been loaded.
      if (isPanelId(id) && visible.includes(id) && !currentlyVisible.includes(id)) {
        delete this.closedPanels[id];
      }
    }

    const updatedArrangement = createMosaicArrangement(visible);
    console.log(`State: Setting visible mosaic panels`, visible, updatedArrangement);

    this.mosaicArrangement = updatedArrangement;

    // after the mosaicArrangement loads, we want to wait for the Mosaic editors to
    // mount to ensure that we can load content into the editors as soon as they're
    // declared visible.

    const waitForEditorsToMount = () => {
      let time = 0;
      const maxTime = 10000;
      const interval = 100;
      return new Promise(function (resolve, reject) {
        (function checkMountedEditors() {
          const allMounted = visible.every(v => !!window.ElectronFiddle.editors[v]);
          if (allMounted) {
            return resolve();
          }
          time += interval;
          if (time > maxTime) {
            return reject();
          }
          setTimeout(checkMountedEditors, 100);
        })();
      });
    }

    await waitForEditorsToMount();
  }

  /**
   * Hides the panel for a given MosaicId.
   *
   * @param {MosaicId} id
   */
  @action public hideAndBackupMosaic(id: MosaicId) {
    const currentlyVisible = getVisibleMosaics(this.mosaicArrangement);
    this.setVisibleMosaics(currentlyVisible.filter((v) => v !== id));
  }

  /**
   * Shows the editor value for a given editor.
   *
   * @param {MosaicId} id
   */
  @action public showMosaic(id: MosaicId) {
    const currentlyVisible = getVisibleMosaics(this.mosaicArrangement);
    this.setVisibleMosaics([...currentlyVisible, id]);
  }

  /**
   * Resets editor view to default layout
   *
   *
   */
  @action public resetEditorLayout() {
    this.mosaicArrangement = DEFAULT_MOSAIC_ARRANGEMENT;
  }

  /**
   * Resets the view, optionally with certain view flags enabled.
   *
   * @param {Record<string, boolean>} [additionalOptions]
   * @memberof AppState
   */
  @action private resetView(additionalOptions?: Record<string, boolean>) {
    this.isTokenDialogShowing = false;
    this.isSettingsShowing = false;
    this.isTourShowing = false;
    this.isConsoleShowing = false;
    this.isAddVersionDialogShowing = false;
    this.isThemeDialogShowing = false;

    if (additionalOptions) {
      for (const key in additionalOptions) {
        if (additionalOptions.hasOwnProperty(key)) {
          this[key] = additionalOptions[key];
        }
      }
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
  private save(key: string, value?: string | number | object | null | boolean) {
    if (value) {
      const _value = typeof value === 'object'
        ? JSON.stringify(value)
        : value.toString();

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

export const appState = new AppState();
appState.setVersion(appState.version);
