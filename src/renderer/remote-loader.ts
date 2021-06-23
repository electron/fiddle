import {
  EditorValues,
  ElectronReleaseChannel,
  PACKAGE_NAME,
  VersionSource,
  VersionState,
} from '../interfaces';
import { getOctokit } from '../utils/octokit';
import { ELECTRON_ORG, ELECTRON_REPO } from './constants';
import { getTemplate } from './content';
import { AppState } from './state';
import { getReleaseChannel } from './versions';
import { isKnownFile, isSupportedFile } from '../utils/editor-utils';

export class RemoteLoader {
  constructor(private readonly appState: AppState) {
    for (const name of [
      'fetchExampleAndLoad',
      'fetchGistAndLoad',
      'getPackageVersionFromRef',
      'handleLoadingFailed',
      'handleLoadingSuccess',
      'loadFiddleFromElectronExample',
      'loadFiddleFromGist',
      'setElectronVersionWithRef',
      'verifyCreateCustomEditor',
      'verifyReleaseChannelEnabled',
      'verifyRemoteLoad',
    ]) {
      this[name] = this[name].bind(this);
    }
  }

  public async loadFiddleFromElectronExample(
    _: any,
    exampleInfo: { path: string; ref: string },
  ) {
    console.log(`Loading fiddle from Electron example`, _, exampleInfo);
    const { path, ref } = exampleInfo;
    const prettyName = path.replace('docs/fiddles/', '');
    const ok = await this.verifyRemoteLoad(
      `'${prettyName}' example from the Electron docs for version ${ref}`,
    );
    if (!ok) return;

    this.fetchExampleAndLoad(ref, path);
  }

  public async loadFiddleFromGist(_: any, gistInfo: { id: string }) {
    const { id } = gistInfo;
    const ok = await this.verifyRemoteLoad(`gist`);
    if (!ok) return;

    this.fetchGistAndLoad(id);
  }

  public async fetchExampleAndLoad(
    ref: string,
    path: string,
  ): Promise<boolean> {
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

      const values = await getTemplate(this.appState.version);
      if (!Array.isArray(folder.data)) {
        throw new Error(
          'The example Fiddle tried to launch is not a valid Electron example',
        );
      }

      const loaders: Array<Promise<void>> = [];

      for (const child of folder.data) {
        if (!child.download_url) {
          console.warn(`Could not find download_url for ${child.name}`);
          continue;
        }

        if (isSupportedFile(child.name)) {
          loaders.push(
            fetch(child.download_url)
              .then((r) => r.text())
              .then((t) => {
                values[child.name] = t;
              }),
          );
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
   * @memberof RemoteLoader
   */
  public async fetchGistAndLoad(gistId: string): Promise<boolean> {
    try {
      const octo = await getOctokit(this.appState);
      const gist = await octo.gists.get({ gist_id: gistId });
      const values: EditorValues = {};

      for (const [id, data] of Object.entries(gist.data.files)) {
        if (!isSupportedFile(id)) {
          continue;
        }
        if (isKnownFile(id) || (await this.verifyCreateCustomEditor(id))) {
          values[id] = data.content;
        }
      }

      return this.handleLoadingSuccess(values, gistId);
    } catch (error) {
      return this.handleLoadingFailed(error);
    }
  }

  public async setElectronVersionWithRef(ref: string): Promise<boolean> {
    const version = await this.getPackageVersionFromRef(ref);

    if (!this.appState.hasVersion(version)) {
      const versionToDownload = {
        source: VersionSource.remote,
        state: VersionState.unknown,
        version,
      };

      try {
        this.appState.addNewVersions([versionToDownload]);
        await this.appState.downloadVersion(versionToDownload);
      } catch {
        await this.appState.removeVersion(versionToDownload);
        this.handleLoadingFailed(
          new Error(`Failed to download Electron version ${version}`),
        );
        return false;
      }
    }

    // check if version is part of release channel
    const versionReleaseChannel: ElectronReleaseChannel = getReleaseChannel(
      version,
    );

    if (!this.appState.channelsToShow.includes(versionReleaseChannel)) {
      const ok = await this.verifyReleaseChannelEnabled(versionReleaseChannel);
      if (!ok) return false;

      this.appState.channelsToShow.push(versionReleaseChannel);
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
      path: PACKAGE_NAME,
    });

    if (!Array.isArray(packageJsonData) && !!packageJsonData.content) {
      const packageJsonString = Buffer.from(
        packageJsonData.content,
        'base64',
      ).toString('utf8');
      const { version } = JSON.parse(packageJsonString);
      return version;
    } else {
      console.error(
        `getPackageVersionFromRef: Received unexpected response from GitHub, could not parse version`,
        {
          packageJsonData,
        },
      );

      return '0.0.0';
    }
  }

  public verifyCreateCustomEditor(editorName: string): Promise<boolean> {
    return this.appState.showConfirmDialog({
      cancel: 'Skip',
      label: `Do you want to create a custom editor with name: ${editorName}?`,
      ok: 'Create',
    });
  }

  /**
   * Verifies from the user that we should be loading this fiddle.
   *
   * @param {string} what What are we loading from (gist, example, etc.)
   */
  public verifyRemoteLoad(what: string): Promise<boolean> {
    return this.appState.showConfirmDialog({
      label: `Are you sure you want to load this ${what}? Only load and run it if you trust the source.`,
      ok: 'Load',
    });
  }

  public verifyReleaseChannelEnabled(channel: string): Promise<boolean> {
    return this.appState.showConfirmDialog({
      label: `You're loading an example with a version of Electron with an unincluded release
              channel (${channel}). Do you want to enable the release channel to load the
              version of Electron from the example?`,
      ok: 'Enable',
    });
  }

  /**
   * Loading a fiddle from GitHub succeeded, let's move on.
   *
   * @param {EditorValues} values
   * @param {string} gistId
   * @returns {boolean}
   */
  private async handleLoadingSuccess(
    values: EditorValues,
    gistId: string,
  ): Promise<boolean> {
    await window.ElectronFiddle.app.replaceFiddle(values, { gistId });
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
    const failedLabel = `Loading the fiddle failed: ${error.message}`;
    this.appState.showErrorDialog(
      navigator.onLine
        ? failedLabel
        : `Your computer seems to be offline. ${failedLabel}`,
    );

    console.warn(`Loading Fiddle failed`, error);
    return false;
  }
}
