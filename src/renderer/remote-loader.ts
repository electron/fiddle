import * as Octokit from '@octokit/rest';
import { when } from 'mobx';
import { EditorId, EditorValues } from '../interfaces';
import { INDEX_HTML_NAME, MAIN_JS_NAME, PRELOAD_JS_NAME, RENDERER_JS_NAME } from '../shared-constants';
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
    this.setElectronVersionWithRef.bind(this);
    this.getPackageVersionFromRef.bind(this);
    this.handleLoadingSuccess.bind(this);
    this.handleLoadingFailed.bind(this);
  }

  public async loadFiddleFromElectronExample(_: any, exampleInfo: { path: string; ref: string }) {
    console.log(`Loading fiddle from Electron example`, _, exampleInfo);
    const ok = await this.verifyRemoteLoad('example from the Electron docs', exampleInfo.ref);
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

      const ok = await this.setElectronVersionWithRef(ref);
      if (!ok) return false;

      const values = {
        html: await getContent(EditorId.html, this.appState.version),
        renderer: await getContent(EditorId.renderer, this.appState.version),
        main: await getContent(EditorId.main, this.appState.version),
        preload: await getContent(EditorId.preload, this.appState.version),
      };

      const loaders: Array<Promise<void>> = [];
      if (!Array.isArray(folder.data)) {
        throw new Error('The example Fiddle tried to launch is not a valid Electron example');
      }

      for (const child of folder.data) {
        if (!child.download_url) {
          console.warn(`Could not find download_url for ${child.name}`);
          continue;
        }

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

          case PRELOAD_JS_NAME:
            loaders.push(fetch(child.download_url)
              .then((r) => r.text()).then((t) => { values.preload = t; })
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
   * Get data from a gist. If it doesn't exist, return an empty string.
   *
   * @param {Octokit.Response<Octokit.GistsGetResponse>} gist
   * @param {string} name
   * @returns {string}
   * @memberof RemoteLoader
   */
  public getContentOrEmpty(gist: Octokit.Response<Octokit.GistsGetResponse>, name: string): string {
    try {
      return gist.data.files[name].content;
    } catch (error) {
      return '';
    }
  }

  /**
   * Load a fiddle
   *
   * @returns {Promise<boolean>}
   * @memberof RemoteLoader
   */
  public async fetchGistAndLoad(gistId: string): Promise<boolean> {
    try {
      const octo = await getOctokit(this.appState);
      const gist = await octo.gists.get({ gist_id: gistId });

      return this.handleLoadingSuccess({
        html: this.getContentOrEmpty(gist, INDEX_HTML_NAME),
        main: this.getContentOrEmpty(gist, MAIN_JS_NAME),
        renderer: this.getContentOrEmpty(gist, RENDERER_JS_NAME),
        preload: this.getContentOrEmpty(gist, PRELOAD_JS_NAME)
      }, gistId);
    } catch (error) {
      return this.handleLoadingFailed(error);
    }
  }

  public async setElectronVersionWithRef(ref: string): Promise<boolean> {
    const version = await this.getPackageVersionFromRef(ref);

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
    return true;
  }

  public async getPackageVersionFromRef(ref: string): Promise<string> {
    const octo = await getOctokit(this.appState);
    const { data: packageJsonData } = await octo.repos.getContents({
      owner: ELECTRON_ORG,
      repo: ELECTRON_REPO,
      ref,
      path: 'package.json'
    });

    if (!Array.isArray(packageJsonData) && !!packageJsonData.content) {
      const packageJsonString = Buffer.from(packageJsonData.content, 'base64').toString('utf8');
      const { version } = JSON.parse(packageJsonString);
      return version;
    } else {
      console.error(`getPackageVersionFromRef: Received unexpected response from GitHub, could not parse version`, {
        packageJsonData
      });

      return '0.0.0';
    }
  }

  /**
   * Verifies from the user that we should be loading this fiddle
   *
   * @param what What are we loading from (gist, example, etc.)
   */
  public async verifyRemoteLoad(what: string, fiddlePath?: string): Promise<boolean> {
    this.appState.setConfirmationPromptTexts({
      label: `Are you sure you sure you want to load this '${what}' from fiddle path '${fiddlePath}'? Only load and run it if you trust the source.`
    });
    this.appState.isConfirmationPromptShowing = true;
    await when(() => !this.appState.isConfirmationPromptShowing);

    return !!this.appState.confirmationPromptLastResult;
  }

  public async verifyReleaseChannelEnabled(channel: string): Promise<boolean> {
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
    await window.ElectronFiddle.app.replaceFiddle(values, {gistId});
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

    this.appState.toggleWarningDialog();

    console.warn(`Loading Fiddle failed`, error);
    return false;
  }
}
