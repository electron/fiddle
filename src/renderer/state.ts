import * as fsType from 'fs-extra';
import { action, autorun, computed, observable, when } from 'mobx';
import { MosaicNode } from 'react-mosaic-component';

import {
  ALL_MOSAICS,
  DocsDemoPage,
  EditorId,
  ElectronVersion,
  ElectronVersionSource,
  ElectronVersionState,
  MosaicId,
  NpmVersion,
  OutputEntry,
  OutputOptions,
  WarningDialogTexts
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { arrayToStringMap } from '../utils/array-to-stringmap';
import { EditorBackup, getEditorBackup } from '../utils/editor-backup';
import { createMosaicArrangement, getVisibleMosaics } from '../utils/editors-mosaic-arrangement';
import { getName } from '../utils/get-title';
import { fancyImport } from '../utils/import';
import { normalizeVersion } from '../utils/normalize-version';
import { isEditorBackup, isEditorId, isPanelId } from '../utils/type-checks';
import { BinaryManager } from './binary';
import { Bisector } from './bisect';
import { DEFAULT_MOSAIC_ARRANGEMENT } from './constants';
import { getContent, isContentUnchanged } from './content';
import { getLocalTypePathForVersion, updateEditorTypeDefinitions } from './fetch-types';
import { ipcRendererManager } from './ipc';
import { activateTheme } from './themes';

import {
  addLocalVersion,
  ElectronReleaseChannel,
  getDefaultVersion,
  getElectronVersions,
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
  @observable public versionsToShow: Array<ElectronReleaseChannel> =
    this.retrieve('versionsToShow') as Array<ElectronReleaseChannel>
    || [ElectronReleaseChannel.stable, ElectronReleaseChannel.beta];
  @observable public statesToShow: Array<ElectronVersionState> =
    this.retrieve('statesToShow') as Array<ElectronVersionState>
    || [ElectronVersionState.downloading, ElectronVersionState.ready, ElectronVersionState.unknown];
  @observable public isKeepingUserDataDirs: boolean = !!this.retrieve('isKeepingUserDataDirs');
  @observable public isEnablingElectronLogging: boolean = !!this.retrieve('isEnablingElectronLogging');
  @observable public isClearingConsoleOnRun: boolean = !!this.retrieve('isClearingConsoleOnRun');

  // -- Various session-only state ------------------
  @observable public gistId: string = '';
  @observable public versions: Record<string, ElectronVersion> = arrayToStringMap(knownVersions);
  @observable public output: Array<OutputEntry> = [];
  @observable public localPath: string | undefined;
  @observable public warningDialogTexts = { label: '', ok: 'Okay', cancel: 'Cancel' };
  @observable public confirmationDialogTexts = { label: '', ok: 'Okay', cancel: 'Cancel' };
  @observable public warningDialogLastResult: boolean | null = null;
  @observable public confirmationPromptLastResult: boolean | null = null;
  @observable public mosaicArrangement: MosaicNode<MosaicId> | null = DEFAULT_MOSAIC_ARRANGEMENT;
  @observable public templateName: string | undefined;
  @observable public currentDocsDemoPage: DocsDemoPage = DocsDemoPage.DEFAULT;
  @observable public localTypeWatcher: fsType.FSWatcher | undefined;
  @observable public binaryManager: BinaryManager = new BinaryManager();
  @observable public Bisector: Bisector | undefined;

  @observable public isPublishing: boolean = false;
  @observable public isRunning: boolean = false;
  @observable public isUnsaved: boolean = false;
  @observable public isUpdatingElectronVersions: boolean = false;

  // -- Various "isShowing" settings ------------------
  @observable public isBisectCommandShowing: boolean;
  @observable public isConsoleShowing: boolean = false;
  @observable public isTokenDialogShowing: boolean = false;
  @observable public isWarningDialogShowing: boolean = false;
  @observable public isConfirmationPromptShowing: boolean = false;
  @observable public isSettingsShowing: boolean = false;
  @observable public isBisectDialogShowing: boolean = false;
  @observable public isAddVersionDialogShowing: boolean = false;
  @observable public isThemeDialogShowing: boolean = false;
  @observable public isTourShowing: boolean = !localStorage.getItem('hasShownTour');

  // -- Editor Values stored when we close the editor ------------------
  @observable public closedPanels: Partial<Record<MosaicId, EditorBackup | true>> = {
    docsDemo: true // Closed by default
  };

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
    autorun(() => this.save('version', this.version));
    autorun(() => this.save('versionsToShow', this.versionsToShow));
    autorun(() => this.save('statesToShow', this.statesToShow));

    autorun(() => {
      if (this.isUnsaved) {
        window.onbeforeunload = () => {
          this.setWarningDialogTexts({
            label: `The current Fiddle is unsaved. Do you want to exit anyway?`,
            ok: 'Quit'
          });

          this.isWarningDialogShowing = true;

          // We'll wait until the warning dialog was closed
          when(() => !this.isWarningDialogShowing).then(() => {
            // The user confirmed, let's close for real.
            if (this.warningDialogLastResult) {
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
      }
    });

    // Update our known versions
    this.updateElectronVersions();

    // Make sure the console isn't all empty and sad
    this.pushOutput('Console ready 🔬');
  }

  /**
   * Returns the current ElectronVersion or the first
   * one that can be found.
   */
  @computed get currentElectronVersion(): ElectronVersion {
    if (this.versions[this.version]) {
      return this.versions[this.version];
    } else {
      return this.versions[defaultVersion];
    }
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

  @action public toggleWarningDialog() {
    this.isWarningDialogShowing = !this.isWarningDialogShowing;

    if (this.isWarningDialogShowing) {
      this.warningDialogLastResult = null;
    }
  }

  @action public toggleBisectDialog() {
    this.isBisectDialogShowing = !this.isBisectDialogShowing;
  }

  @action public toggleConfirmationPromptDialog() {
    this.isConfirmationPromptShowing = !this.isConfirmationPromptShowing;

    if (this.isConfirmationPromptShowing) {
      this.confirmationPromptLastResult = null;
    }
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

  @action public setWarningDialogTexts(input: WarningDialogTexts) {
    this.warningDialogTexts = {
      ok: 'Okay',
      cancel: 'Cancel',
      ...input
    };
  }

  @action public setConfirmationPromptTexts(input: WarningDialogTexts) {
    this.confirmationDialogTexts = {
      ok: 'Okay',
      cancel: 'Cancel',
      ...input
    };
  }

  @action public addLocalVersion(input: NpmVersion) {
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
    if (release && release.source === ElectronVersionSource.local) {
      delete updatedVersions[version];

      const versionsAsArray = Object
        .keys(updatedVersions)
        .map((k) => updatedVersions[k]);

      saveLocalVersions(versionsAsArray);
    } else {
      await this.binaryManager.remove(version);
      updatedVersions[version].state = ElectronVersionState.unknown;
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
    const isLocal = release.source === ElectronVersionSource.local;
    const isReady = release.state === 'ready';

    // Fetch new binaries, maybe?
    if (!isLocal && !isReady) {
      console.log(`State: Instructing BinaryManager to fetch v${version}`);
      const updatedVersions = { ...this.versions };
      updatedVersions[version] = updatedVersions[version] || {};
      updatedVersions[version].state = ElectronVersionState.downloading;
      this.versions = updatedVersions;

      await this.binaryManager.setup(version);
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

    if (versionObject.source === ElectronVersionSource.local) {
      const fs = await fancyImport<typeof fsType>('fs-extra');
      const typePath = getLocalTypePathForVersion(versionObject);
      console.info(`TypeDefs: Watching file for local version ${version} at path ${typePath}`);
      this.localTypeWatcher = fs.watch(typePath!, async () => {
        console.info(`TypeDefs: Noticed file change at ${typePath}. Updating editor typedefs.`);
        await updateEditorTypeDefinitions(versionObject);
      });
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
    const downloadedVersions = await this.binaryManager.getDownloadedVersions();
    const updatedVersions = { ...this.versions };

    (downloadedVersions || []).forEach((version) => {
      if (updatedVersions[version]) {
        updatedVersions[version].state = ElectronVersionState.ready;
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

  @action public setVisibleMosaics(visible: Array<MosaicId>) {
    const currentlyVisible = getVisibleMosaics(this.mosaicArrangement);

    for (const id of ALL_MOSAICS) {
      if (!visible.includes(id) && currentlyVisible.includes(id)) {
        this.closedPanels[id] = isEditorId(id)
          ? getEditorBackup(id)
          : true;
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
