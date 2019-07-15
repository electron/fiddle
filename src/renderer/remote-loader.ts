import { when } from 'mobx';
import { EditorId, EditorValues } from '../interfaces';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../shared-constants';
import { getTitle } from '../utils/get-title';
import { getOctokit } from '../utils/octokit';
import { sortedElectronMap } from '../utils/sorted-electron-map';
import { ELECTRON_ORG, ELECTRON_REPO } from './constants';
import { getContent } from './content';
import { AppState } from './state';
import { ElectronReleaseChannel, getReleaseChannel } from './versions';

export class RemoteLoader {
  constructor(private readonly appState: AppState) {
    this.loadFiddleFromElectronExample.bind(this);
    this.loadFiddleFromGist.bind(this);
    this.verifyRemoteLoad.bind(this);
    this.verifyReleaseChannelEnabled.bind(this);
    this.fetchExampleAndLoad.bind(this);
    this.fetchGistAndLoad.bind(this);
    this.getElectronVersion.bind(this);
    this.handleLoadingSuccess.bind(this);
    this.handleLoadingFailed.bind(this);
  }

  public async loadFiddleFromElectronExample(_: any, exampleInfo: { path: string; ref: string }) {
    console.log(`Loading fiddle from Electron example`, _, exampleInfo);
    const ok = await this.verifyRemoteLoad('example from the Electron docs');
    if (!ok) return;

    this.fetchExampleAndLoad(exampleInfo.ref, exampleInfo.path);
  }

  public async loadFiddleFromGist(_: any, gistInfo: { id: string }) {
    const ok = await this.verifyRemoteLoad('gist');
    if (!ok) return;

    this.fetchGistAndLoad(gistInfo.id);
  }

  public async fetchExampleAndLoad(ref: string, path: string): Promise<boolean> {
    try {
      const octo = await getOctokit(this.appState);

      const folder = await octo.repos.getContents({
        owner: ELECTRON_REPO,
        repo: ELECTRON_ORG,
        ref,
        path,
      });

      const version = await this.getElectronVersion(ref);

      const supportedVersions = sortedElectronMap(this.appState.versions, (k) => k);
      if (!supportedVersions.includes(version)) {
        this.handleLoadingFailed(new Error('Version of Electron in example not supported'));
        return false;
      }

      // check if version is part of release channel
      const versionReleaseChannel: ElectronReleaseChannel = getReleaseChannel(version);

      if (!this.appState.versionsToShow.includes(versionReleaseChannel)) {

        const ok = await this.verifyReleaseChannelEnabled(versionReleaseChannel);
        if (!ok) return false;

        this.appState.versionsToShow.push(versionReleaseChannel);
      }

      this.appState.setVersion(version);

      const values = {
        html: await getContent(EditorId.html, this.appState.version),
        renderer: await getContent(EditorId.renderer, this.appState.version),
        main: await getContent(EditorId.main, this.appState.version),
      };

      const loaders: Array<Promise<void>> = [];
      if (!Array.isArray(folder.data)) {
        throw new Error('The example Fiddle tried to launch is not a valid Electron example');
      }

      for (const child of folder.data) {
        switch (child.name) {
          case MAIN_JS_NAME:
            loaders.push(fetch(child.download_url)
              .then((r) => r.text()).then((t) => { values.main = t; })
            );

            break;
          case INDEX_HTML_NAME:
            loaders.push(fetch(child.download_url)
              .then((r) => r.text()).then((t) => { values.html = t; })
            );

            break;
          case RENDERER_JS_NAME:
            loaders.push(fetch(child.download_url)
              .then((r) => r.text()).then((t) => { values.renderer = t; })
            );

            break;
          default:
            break;
        }
      }

      await Promise.all(loaders);

      return this.handleLoadingSuccess(values, '');
    } catch (error) {
      return this.handleLoadingFailed(error);
    }
  }

  /**
   * Load a fiddle
   *
   * @returns {Promise<boolean>}
   * @memberof AddressBar
   */
  public async fetchGistAndLoad(gistId: string): Promise<boolean> {
    try {
      const octo = await getOctokit(this.appState);
      const gist = await octo.gists.get({ gist_id: gistId });

      return this.handleLoadingSuccess({
        html: gist.data.files[INDEX_HTML_NAME].content,
        main: gist.data.files[MAIN_JS_NAME].content,
        renderer: gist.data.files[RENDERER_JS_NAME].content,
      }, gistId);
    } catch (error) {
      return this.handleLoadingFailed(error);
    }
  }

  private async getElectronVersion(ref: string): Promise<string> {
    const octo = await getOctokit(this.appState);
    const { data: packageJsonData } = await octo.repos.getContents({
      owner: ELECTRON_ORG,
      repo: ELECTRON_REPO,
      ref,
      path: 'package.json'
    });

    const packageJsonString = Buffer.from(packageJsonData.content, 'base64').toString('utf8');
    const { version } = JSON.parse(packageJsonString);
    return version;
  }

  /**
   * Verifies from the user that we should be loading this fiddle
   *
   * @param what What are we loading from (gist, example, etc.)
   */
  private async verifyRemoteLoad(what: string): Promise<boolean> {
    this.appState.setWarningDialogTexts({
      label: `Are you sure you sure you want to load this ${what}? Only load and run it if you trust the source`
    });
    this.appState.isWarningDialogShowing = true;
    await when(() => !this.appState.isWarningDialogShowing);

    return !!this.appState.warningDialogLastResult;
  }

  private async verifyReleaseChannelEnabled(channel: string): Promise<boolean> {
    this.appState.setWarningDialogTexts({
      label: `You're loading an example with a version of Electron with an unincluded release
              channel (${channel}). Do you want to enable the release channel to load the
              version of Electron from the example?`
    });
    this.appState.isWarningDialogShowing = true;
    await when(() => !this.appState.isWarningDialogShowing);

    return !!this.appState.warningDialogLastResult;
  }

  /**
   * Loading a fiddle from GitHub succeeded, let's move on.
   *
   * @param {Partial<EditorValues>} values
   * @param {string} gistId
   * @returns {boolean}
   */
  private async handleLoadingSuccess(values: Partial<EditorValues>, gistId: string): Promise<boolean> {
    this.appState.setWarningDialogTexts({
      label: 'Loading the fiddle will replace your current unsaved changes. Do you want to discard them?'
    });

    await window.ElectronFiddle.app.setValues(values);

    document.title = getTitle(this.appState);
    this.appState.gistId = gistId;
    this.appState.localPath = undefined;
    this.appState.templateName = undefined;

    return true;
  }

  /**
   * Loading a fiddle from GitHub failed - this method handles this case
   * gracefully.
   *
   * @param {Error} error
   * @returns {boolean}
   */
  private handleLoadingFailed(error: Error): false {
    if (navigator.onLine) {
      this.appState.setWarningDialogTexts({
        label: `Loading the fiddle failed: ${error}`,
        cancel: undefined
      });
    } else {
      this.appState.setWarningDialogTexts({
        label: `Loading the fiddle failed. Your computer seems to be offline. Error: ${error}`,
        cancel: undefined
      });
    }

    this.appState.toogleWarningDialog();

    console.warn(`Loading Fiddle failed`, error);
    return false;
  }
}
