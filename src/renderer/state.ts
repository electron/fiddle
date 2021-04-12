import * as fs from 'fs-extra';
import { action, autorun, computed, observable, when } from 'mobx';
import { MosaicNode } from 'react-mosaic-component';

import {
  ALL_EDITORS,
  ALL_MOSAICS,
  BlockableAccelerator,
  DocsDemoPage,
  EditorId,
  ElectronReleaseChannel,
  GenericDialogOptions,
  GenericDialogType,
  GistActionState,
  MosaicId,
  OutputEntry,
  OutputOptions,
  RunnableVersion,
  SetFiddleOptions,
  Version,
  VersionSource,
  VersionState,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { EditorBackup, getEditorBackup } from '../utils/editor-backup';
import {
  createMosaicArrangement,
  getVisibleMosaics,
} from '../utils/editors-mosaic-arrangement';
import { getName } from '../utils/get-name';
import { normalizeVersion } from '../utils/normalize-version';
import { isEditorBackup, isEditorId, isPanelId } from '../utils/type-checks';
import { getVersionState, removeBinary, setupBinary } from './binary';
import { Bisector } from './bisect';
import { DEFAULT_CLOSED_PANELS, DEFAULT_MOSAIC_ARRANGEMENT } from './constants';
import { getTemplate, isContentUnchanged } from './content';
import {
  getLocalTypePathForVersion,
  updateEditorTypeDefinitions,
} from './fetch-types';
import { ipcRendererManager } from './ipc';
import { activateTheme } from './themes';

import { waitForEditorsToMount } from '../utils/editor-mounted';
import { sortVersions } from '../utils/sort-versions';
import { IPackageManager } from './npm';
import {
  addLocalVersion,
  getDefaultVersion,
  getElectronVersions,
  getReleaseChannel,
  getUpdatedElectronVersions,
  saveLocalVersions,
} from './versions';

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
  @observable public statesToShow: Array<VersionState> = (this.retrieve(
    'statesToShow',
  ) as Array<VersionState>) || [
    VersionState.downloading,
    VersionState.ready,
    VersionState.unknown,
  ];
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
  @observable public genericDialogLastResult: boolean | null = null;
  @observable public genericDialogLastInput: string | null = null;
  @observable
  public mosaicArrangement: MosaicNode<MosaicId> | null = DEFAULT_MOSAIC_ARRANGEMENT;
  @observable public templateName: string | undefined;
  @observable public currentDocsDemoPage: DocsDemoPage = DocsDemoPage.DEFAULT;
  @observable public localTypeWatcher: fs.FSWatcher | undefined;
  @observable public Bisector: Bisector | undefined;

  @observable public activeGistAction: GistActionState = GistActionState.none;
  @observable public isRunning = false;
  @observable public isAutoBisecting = false;
  @observable public isInstallingModules = false;
  @observable public isUnsaved: boolean;
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
  @observable public closedPanels: Partial<
    Record<MosaicId, EditorBackup | true>
  > = DEFAULT_CLOSED_PANELS;

  private outputBuffer = '';
  private name: string;
  private readonly defaultVersion: string;
  public appData: string;

  constructor(versions: RunnableVersion[]) {
    // Bind all actions
    this.downloadVersion = this.downloadVersion.bind(this);
    this.pushError = this.pushError.bind(this);
    this.pushOutput = this.pushOutput.bind(this);
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
    this.resetEditorLayout = this.resetEditorLayout.bind(this);
    this.setIsQuitting = this.setIsQuitting.bind(this);
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
    autorun(() => this.save('statesToShow', this.statesToShow));
    autorun(() => this.save('packageManager', this.packageManager ?? 'npm'));
    autorun(() => this.save('acceleratorsToBlock', this.acceleratorsToBlock));

    autorun(async () => {
      if (typeof this.isUnsaved === 'undefined') return;

      if (this.isUnsaved) {
        window.onbeforeunload = () => {
          ipcRendererManager.send(IpcEvents.SHOW_INACTIVE);
          this.setGenericDialogOptions({
            type: GenericDialogType.warning,
            label: `The current Fiddle is unsaved. Do you want to exit anyway?`,
            ok: 'Exit',
          });

          this.isGenericDialogShowing = true;

          // We'll wait until the warning dialog was closed
          when(() => !this.isGenericDialogShowing).then(() => {
            const closeConfirmed = this.genericDialogLastResult;
            // The user confirmed, let's close for real.
            if (closeConfirmed) {
              // isQuitting checks if we're trying to quit the app
              // or just close the window
              if (this.isQuitting) {
                ipcRendererManager.send(IpcEvents.CONFIRM_QUIT);
              }
              window.onbeforeunload = null;
              window.close();
            }
          });

          // return value doesn't matter, we just want to cancel the event
          return false;
        };
      } else {
        window.onbeforeunload = null;

        // set up editor listeners to verify if unsaved
        const ids = ALL_EDITORS.filter(
          (id) => id in window.ElectronFiddle.editors,
        );
        await waitForEditorsToMount(ids);
        for (const editor of Object.values(window.ElectronFiddle.editors)) {
          const disposable = editor!.onDidChangeModelContent(() => {
            this.isUnsaved = true;
            disposable.dispose();
          });
        }
      }
    });

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
    const { gistId, isUnsaved, localPath, templateName } = this;
    const tokens = [];

    if (localPath) {
      tokens.push(localPath);
    } else if (templateName) {
      tokens.push(templateName);
    } else if (gistId) {
      tokens.push(`gist.github.com/${gistId}`);
    }

    if (isUnsaved) {
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
    const { channelsToShow, statesToShow, versions } = this;

    const filter = (ver: RunnableVersion) =>
      ver &&
      statesToShow.includes(ver.state) &&
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
  @action public async downloadVersion(input: string) {
    let ver = this.getVersion(input);

    // ensure the version is tracked in 'this.versions'
    if (!ver) {
      ver = {
        source: VersionSource.remote,
        state: VersionState.unknown,
        version: normalizeVersion(input),
      };
      ver.state = getVersionState(ver);
      this.versions[ver.version] = ver;
    }

    const isRemote = ver.source === VersionSource.remote;
    const isReady = ver.state === VersionState.ready;
    const { version } = ver;
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
    if (await isContentUnchanged(EditorId.main, this.version)) {
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
    } else {
      if (!!this.localTypeWatcher) {
        console.info(
          `TypeDefs: Switched to downloaded version ${version}. Unwatching local typedefs.`,
        );
        this.localTypeWatcher.close();
        this.localTypeWatcher = undefined;
      }
    }
    await updateEditorTypeDefinitions(ver);

    // Fetch new binaries, maybe?
    await this.downloadVersion(version);
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
    data: string | Buffer,
    options: OutputOptions = { isNotPre: false, bypassBuffer: true },
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

  /**
   * Sets the editor value for a given editor. Deletes the value after
   * accessing it.
   *
   * @param {EditorId} id
   */
  @action public getAndRemoveEditorValueBackup(
    id: EditorId,
  ): EditorBackup | null {
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
        this.closedPanels[id] = isEditorId(id) ? getEditorBackup(id) : true;

        // if we have backup, remove active editor
        delete window.ElectronFiddle.editors[id];
      }

      // Remove the backup for panels now. Editors will remove their
      // backup once the data has been loaded.
      if (
        isPanelId(id) &&
        visible.includes(id) &&
        !currentlyVisible.includes(id)
      ) {
        delete this.closedPanels[id];
      }
    }

    const updatedArrangement = createMosaicArrangement(visible);
    console.log(
      `State: Setting visible mosaic panels`,
      visible,
      updatedArrangement,
    );

    this.mosaicArrangement = updatedArrangement;

    // after the mosaicArrangement loads, we want to wait for the Mosaic editors to
    // mount to ensure that we can load content into the editors as soon as they're
    // declared visible.

    await waitForEditorsToMount(visible);
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
