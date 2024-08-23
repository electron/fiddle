import semver from 'semver';

import { ELECTRON_ORG, ELECTRON_REPO } from './constants';
import { AppState } from './state';
import { disableDownload } from './utils/disable-download';
import { isKnownFile, isSupportedFile } from './utils/editor-utils';
import { getOctokit } from './utils/octokit';
import { getReleaseChannel } from './versions';
import {
  EditorId,
  EditorValues,
  ElectronReleaseChannel,
  GenericDialogType,
  InstallState,
  PACKAGE_NAME,
  VersionSource,
} from '../interfaces';

export class RemoteLoader {
  constructor(private readonly appState: AppState) {
    for (const name of [
      'fetchExampleAndLoad',
      'fetchGistAndLoad',
      'handleLoadingFailed',
      'handleLoadingSuccess',
      'loadFiddleFromElectronExample',
      'loadFiddleFromGist',
      'setElectronVersion',
      'verifyReleaseChannelEnabled',
      'verifyRemoteLoad',
    ] as const) {
      this[name] = this[name].bind(this);
    }
  }

  public async loadFiddleFromElectronExample(exampleInfo: {
    path: string;
    tag: string;
  }) {
    console.log(`Loading fiddle from Electron example`, exampleInfo);
    const { path, tag } = exampleInfo;
    const prettyName = path.replace('docs/fiddles/', '');
    const ok = await this.verifyRemoteLoad(
      `'${prettyName}' example from the Electron docs for version ${tag}`,
    );
    if (!ok) return;

    this.fetchExampleAndLoad(tag, path);
  }

  public async loadFiddleFromGist(gistInfo: { id: string }) {
    const { id } = gistInfo;
    const ok = await this.verifyRemoteLoad(`gist`);
    if (!ok) return;

    this.fetchGistAndLoad(id);
  }

  public async fetchExampleAndLoad(
    tag: string,
    path: string,
  ): Promise<boolean> {
    try {
      const octo = await getOctokit(this.appState);
      const folder = await octo.repos.getContents({
        owner: ELECTRON_REPO,
        repo: ELECTRON_ORG,
        ref: tag,
        path,
      });

      const index = tag.search(/\d/);
      const version = tag.substring(index);

      if (!semver.valid(version)) {
        throw new Error('Could not determine Electron version for example');
      }

      const ok = await this.setElectronVersion(version);
      if (!ok) return false;

      const values = await window.ElectronFiddle.getTemplate(
        this.appState.version,
      );
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
                values[child.name as EditorId] = t;
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
   */
  public async fetchGistAndLoad(gistId: string): Promise<boolean> {
    try {
      const octo = await getOctokit(this.appState);
      const gist = await octo.gists.get({ gist_id: gistId });
      const values: EditorValues = {};

      for (const [id, data] of Object.entries(gist.data.files)) {
        const content = data.truncated
          ? await fetch(data.raw_url!).then((r) => r.text())
          : data.content!;

        if (id === PACKAGE_NAME) {
          const deps: Record<string, string> = {};
          try {
            const { dependencies, devDependencies } = JSON.parse(content);
            Object.assign(deps, dependencies, devDependencies);
          } catch (e) {
            throw new Error('Invalid JSON found in package.json');
          }

          // If the gist specifies an Electron version, we want to tell Fiddle to run
          // it with that version by default.
          const electronDeps = Object.keys(deps).filter((d) =>
            ['electron-nightly', 'electron'].includes(d),
          );
          for (const dep of electronDeps) {
            // Strip off semver range prefixes, e.g:
            // ^1.2.0 -> 1.2.0
            // ~2.3.4 -> 2.3.4
            const index = deps[dep].search(/\d/);
            const version = deps[dep].substring(index);

            if (
              !semver.valid(version) ||
              !(await window.ElectronFiddle.isReleasedMajor(
                semver.major(version),
              ))
            ) {
              await this.appState.showGenericDialog({
                label: `The Electron version (${version}) in this gist's package.json is invalid. Falling back to last used version.`,
                ok: 'Close',
                type: GenericDialogType.warning,
                wantsInput: false,
              });
            } else if (disableDownload(version)) {
              await this.appState.showGenericDialog({
                label: `This gist's Electron version (${version}) is not available on your current OS. Falling back to last used version.`,
                ok: 'Close',
                type: GenericDialogType.warning,
                wantsInput: false,
              });
            } else {
              this.setElectronVersion(version);
            }

            // We want to include all dependencies except Electron.
            delete deps[dep];
          }

          this.appState.modules = new Map(Object.entries(deps));
        }

        // JSON files are supported, but we don't want to add package.json
        // or the lockfile to the visible editor array.
        if ([PACKAGE_NAME, 'package-lock.json'].includes(id)) continue;

        if (!isSupportedFile(id)) continue;

        if (isKnownFile(id) || (await this.confirmAddFile(id))) {
          values[id] = content;
        }
      }

      // If no files were populated into values, the Fiddle did not
      // contain any supported files. Throw an error to let the user know.
      if (Object.keys(values).length === 0) {
        throw new Error(
          'This Gist did not contain any supported files. Supported files must have one of the following extensions: .cjs, .js, .mjs, .css, or .html.',
        );
      }

      return this.handleLoadingSuccess(values, gistId);
    } catch (error) {
      return this.handleLoadingFailed(error);
    }
  }

  public async setElectronVersion(version: string): Promise<boolean> {
    if (!this.appState.hasVersion(version)) {
      const versionToDownload = {
        source: VersionSource.remote,
        state: InstallState.missing,
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
    const versionReleaseChannel: ElectronReleaseChannel =
      getReleaseChannel(version);

    if (!this.appState.channelsToShow.includes(versionReleaseChannel)) {
      const ok = await this.verifyReleaseChannelEnabled(versionReleaseChannel);
      if (!ok) return false;

      this.appState.channelsToShow.push(versionReleaseChannel);
    }

    this.appState.setVersion(version);
    return true;
  }

  public confirmAddFile = (filename: string): Promise<boolean> => {
    return this.appState.showConfirmDialog({
      cancel: 'Skip',
      label: `Do you want to add "${filename}"?`,
      ok: 'Add',
    });
  };

  /**
   * Verifies from the user that we should be loading this fiddle.
   *
   * @param what - What are we loading from (gist, example, etc.)
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
   */
  private async handleLoadingSuccess(
    values: EditorValues,
    gistId: string,
  ): Promise<boolean> {
    await window.app.replaceFiddle(values, { gistId });
    return true;
  }

  /**
   * Loading a fiddle from GitHub failed - this method handles this case
   * gracefully.
   */
  private handleLoadingFailed(error: Error): false {
    const failedLabel = `Loading the fiddle failed: ${error.message}`;
    this.appState.showErrorDialog(
      this.appState.isOnline
        ? failedLabel
        : `Your computer seems to be offline. ${failedLabel}`,
    );

    console.warn(`Loading Fiddle failed`, error);
    return false;
  }
}
