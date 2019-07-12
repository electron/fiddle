import { Button, InputGroup, Intent } from '@blueprintjs/core';
import classnames from 'classnames';
import { reaction, when } from 'mobx';
import { observer } from 'mobx-react';
import * as React from 'react';

import { EditorId, EditorValues } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../../shared-constants';
import { getTitle } from '../../utils/get-title';
import { idFromUrl, urlFromId } from '../../utils/gist';
import { getOctokit } from '../../utils/octokit';
import { getContent } from '../content';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';

export interface AddressBarProps {
  appState: AppState;
}

export interface AddressBarState {
  value: string;
}

@observer
export class AddressBar extends React.Component<AddressBarProps, AddressBarState> {
  constructor(props: AddressBarProps) {
    super(props);

    this.fetchExampleAndLoad = this.fetchExampleAndLoad.bind(this);
    this.fetchGistAndLoad = this.fetchGistAndLoad.bind(this);
    this.loadFiddleFromGist = this.loadFiddleFromGist.bind(this);
    this.loadFiddleFromElectronExample = this.loadFiddleFromElectronExample.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.submit = this.submit.bind(this);
    this.verifyRemoteLoad = this.verifyRemoteLoad.bind(this);

    const { gistId } = this.props.appState;
    const value = gistId ? urlFromId(gistId) : '';

    this.state = { value };
  }

  /**
   * Handle the form's submit event, trying to load whatever
   * URL was entered.
   *
   * @param {React.SyntheticEvent<HTMLFormElement>} event
   */
  public handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    this.submit();
  }

  /**
   * Commit the address bar's value to app state and load the fiddle.
   *
   * @memberof AddressBar
   */
  public submit() {
    if (this.state.value) {
      this.fetchGistAndLoad(idFromUrl(this.state.value) || this.state.value);
    }
  }

  /**
   * Once the component mounts, we'll subscribe to gistId changes
   */
  public componentDidMount() {
    reaction(
      () => this.props.appState.gistId,
      (gistId: string) => this.setState({ value: urlFromId(gistId) })
    );
    ipcRendererManager.on(IpcEvents.LOAD_GIST_REQUEST, this.loadFiddleFromGist);
    ipcRendererManager.on(IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST, this.loadFiddleFromElectronExample);
  }

  public componentWillUnmount() {
    ipcRendererManager.removeListener(IpcEvents.LOAD_GIST_REQUEST, this.loadFiddleFromGist);
    ipcRendererManager.removeListener(IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST, this.loadFiddleFromElectronExample);
  }

  public async loadFiddleFromElectronExample(_: any, exampleInfo: { path: string; ref: string }) {
    console.log(`Loading fiddle from Electron example`, _, exampleInfo);
    const ok = await this.verifyRemoteLoad('example from the Electron docs', exampleInfo.ref );
    if (!ok) return;

    this.fetchExampleAndLoad(exampleInfo.ref, exampleInfo.path);
  }

  public async loadFiddleFromGist(_: any, gistInfo: { id: string }) {
    const ok = await this.verifyRemoteLoad('gist');
    if (!ok) return;

    this.fetchGistAndLoad(gistInfo.id);
  }

  /**
   * Verifies from the user that we should be loading this fiddle
   *
   * @param what What are we loading from (gist, example, etc.)
   */
  public async verifyRemoteLoad(what: string, fiddlePath?: string): Promise<boolean> {
    const { appState } = this.props;
    appState.setConfirmationPromptTexts({
      label: `Are you sure you sure you want to load this '${what}' from fiddle path '${fiddlePath}'? Only load and run it if you trust the source.`
    });
    appState.isConfirmationPromptShowing = true;
    await when(() => !appState.isConfirmationPromptShowing);

    return !!appState.confirmationPromptLastResult;
  }

  /**
   * Handle the change event, which usually just updates the address bar's value
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ value: event.target.value });
  }

  public async fetchExampleAndLoad(ref: string, path: string): Promise<boolean> {
    const { appState } = this.props;

    try {
      const octo = await getOctokit(this.props.appState);

      // TODO: Maybe we should fetch the package.json for the given ref to use the correct version of Electron?
      const folder = await octo.repos.getContents({
        owner: 'electron',
        repo: 'electron',
        ref,
        path,
      });

      const values = {
        html: await getContent(EditorId.html, appState.version),
        renderer: await getContent(EditorId.renderer, appState.version),
        main: await getContent(EditorId.main, appState.version),
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
      const octo = await getOctokit(this.props.appState);
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

  public renderLoadButton(isValueCorrect: boolean): JSX.Element {
    return (
      <Button
        disabled={!isValueCorrect}
        icon='cloud-download'
        text='Load Fiddle'
        onClick={this.submit}
      />
    );
  }

  public render() {
    const { isUnsaved, isPublishing } = this.props.appState;
    const { value } = this.state;
    const isCorrect = /https:\/\/gist\.github\.com\/(.+)$/.test(value);
    const className = classnames('address-bar', isUnsaved, { empty: !value });

    return (
      <form className={className} onSubmit={this.handleSubmit}>
        <fieldset disabled={isPublishing}>
          <InputGroup
            key='addressbar'
            leftIcon='geosearch'
            intent={isCorrect || !value ? undefined : Intent.DANGER}
            onChange={this.handleChange}
            placeholder='https://gist.github.com/...'
            value={value}
            rightElement={this.renderLoadButton(isCorrect)}
          />
        </fieldset>
      </form>
    );
  }

  /**
   * Loading a fiddle from GitHub succeeded, let's move on.
   *
   * @private
   * @param {Partial<EditorValues>} values
   * @param {string} gistId
   * @returns {boolean}
   */
  private async handleLoadingSuccess(values: Partial<EditorValues>, gistId: string): Promise<boolean> {
    const { appState } = this.props;

    appState.setWarningDialogTexts({
      label: 'Loading the fiddle will replace your current unsaved changes. Do you want to discard them?'
    });

    await window.ElectronFiddle.app.setValues(values);

    document.title = getTitle(appState);
    appState.gistId = gistId;
    appState.localPath = undefined;
    appState.templateName = undefined;

    return true;
  }

  /**
   * Loading a fiddle from GitHub failed - this method handles this case
   * gracefully.
   *
   * @private
   * @param {Error} error
   * @returns {boolean}
   */
  private handleLoadingFailed(error: Error): false {
    if (navigator.onLine) {
      this.props.appState.setWarningDialogTexts({
        label: `Loading the fiddle failed: ${error}`,
        cancel: undefined
      });
    } else {
      this.props.appState.setWarningDialogTexts({
        label: `Loading the fiddle failed. Your computer seems to be offline. Error: ${error}`,
        cancel: undefined
      });
    }

    this.props.appState.toogleWarningDialog();

    console.warn(`Loading Fiddle failed`, error);
    return false;
  }
}
