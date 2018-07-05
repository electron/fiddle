import { observable, action, autorun } from 'mobx';
import * as tmp from 'tmp';

import { BinaryManager } from './binary';
import { ElectronVersion, StringMap, OutputEntry } from '../interfaces';
import { arrayToStringMap } from '../utils/array-to-stringmap';
import { getKnownVersions, getUpdatedKnownVersions } from './versions';
import { normalizeVersion } from '../utils/normalize-version';
import { updateEditorTypeDefinitions } from './fetch-types';
import { ipcRendererManager } from './ipc';
import { IpcEvents } from '../ipc-events';

const knownVersions = getKnownVersions();
const defaultVersion = normalizeVersion(knownVersions[0].tag_name);

/**
 * Editors exist outside of React's world. To make things *a lot*
 * easier, we keep them around in a global object. Don't judge us,
 * we're really only doing that for the editors.
 */
window.ElectronFiddle = {
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
  @observable public gistId: string = '';
  @observable public version: string = defaultVersion;
  @observable public tmpDir: tmp.SynchrounousResult = tmp.dirSync();
  @observable public gitHubAvatarUrl: string | null = localStorage.getItem('gitHubAvatarUrl');
  @observable public gitHubName: string | null = localStorage.getItem('gitHubName');
  @observable public gitHubLogin: string | null = localStorage.getItem('gitHubLogin');
  @observable public gitHubToken: string | null = localStorage.getItem('gitHubToken') || null;
  @observable public binaryManager: BinaryManager = new BinaryManager();
  @observable public versions: StringMap<ElectronVersion> = arrayToStringMap(knownVersions);
  @observable public output: Array<OutputEntry> = [];
  @observable public localPath: string | null = null;
  @observable public isConsoleShowing: boolean = false;
  @observable public isTokenDialogShowing: boolean = false;
  @observable public isSettingsShowing: boolean = false;
  @observable public isUnsaved: boolean = false;
  @observable public isMyGist: boolean = false;

  constructor() {
    // Bind all actions
    this.toggleConsole = this.toggleConsole.bind(this);
    this.toggleAuthDialog = this.toggleAuthDialog.bind(this);
    this.toggleSettings = this.toggleSettings.bind(this);

    this.setVersion = this.setVersion.bind(this);
    this.downloadVersion = this.downloadVersion.bind(this);
    this.removeVersion = this.removeVersion.bind(this);

    this.signOutGitHub = this.signOutGitHub.bind(this);

    // When the settings should be opened, we'll close
    // everything else
    ipcRendererManager.on(IpcEvents.OPEN_SETTINGS, this.toggleSettings);

    // Setup autoruns
    autorun(() => localStorage.setItem('gitHubToken', this.gitHubToken || ''));
    autorun(() => localStorage.setItem('gitHubAvatarUrl', this.gitHubAvatarUrl || ''));
    autorun(() => localStorage.setItem('gitHubName', this.gitHubName || ''));
    autorun(() => localStorage.setItem('gitHubLogin', this.gitHubLogin || ''));

    // Update our known versions
    getUpdatedKnownVersions().then((versions) => {
      this.versions = arrayToStringMap(versions);
    });
  }

  @action public toggleConsole() {
    this.isConsoleShowing = !this.isConsoleShowing;
  }

  @action public toggleAuthDialog() {
    this.isTokenDialogShowing = !this.isTokenDialogShowing;
  }

  @action public toggleSettings() {
    this.isSettingsShowing = !this.isSettingsShowing;
  }

 /*
  * Remove a version of Electron
  *
  * @param {string} input
  * @returns {Promise<void>}
  */
  @action public async removeVersion(input: string) {
    const version = normalizeVersion(input);
    console.log(`State: Removing Electron ${version}`);

    // Already not present?
    if ((this.versions[version] || { state: '' }).state !== 'ready') {
      console.log(`State: Version already removed, doing nothing`);
      return;
    }

    // Actually remove
    await this.binaryManager.remove(version);

    // Update state
    const updatedVersions = { ...this.versions };
    updatedVersions[version].state = 'unknown';

    this.versions = updatedVersions;
    this.updateDownloadedVersionState();
  }

 /*
  * Download a version of Electron.
  *
  * @param {string} input
  * @returns {Promise<void>}
  */
  @action public async downloadVersion(input: string) {
    const version = normalizeVersion(input);
    console.log(`State: Downloading Electron ${version}`);

    // Fetch new binaries, maybe?
    if ((this.versions[version] || { state: '' }).state !== 'ready') {
      console.log(`State: Instructing BinaryManager to fetch v${version}`);
      const updatedVersions = { ...this.versions };
      updatedVersions[version].state = 'downloading';
      this.versions = updatedVersions;

      await this.binaryManager.setup(version);
      this.updateDownloadedVersionState();
    } else {
      console.log(`State: Version ${version} already downloaded, doing nothing.`);
    }
  }

 /*
  * Select a version of Electron (and download it if necessary).
  *
  * @param {string} input
  * @returns {Promise<void>}
  */
  @action public async setVersion(input: string) {
    const version = normalizeVersion(input);
    console.log(`State: Switching to Electron ${version}`);

    this.version = version;

    // Update TypeScript definitions
    updateEditorTypeDefinitions(version);

    // Fetch new binaries, maybe?
    await this.downloadVersion(version);
  }

 /*
  * Go and check which versions have already been downloaded.
  *
  * @returns {Promise<void>}
  */
  @action public async updateDownloadedVersionState(): Promise<void> {
    const downloadedVersions = await this.binaryManager.getDownloadedVersions();
    const updatedVersions = { ...this.versions };

    console.log(`State: Updating version state`);
    downloadedVersions.forEach((version) => {
      if (updatedVersions[version]) {
        updatedVersions[version].state = 'ready';
      }
    });

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
}

export const appState = new AppState();
appState.setVersion(appState.version);

tmp.setGracefulCleanup();
