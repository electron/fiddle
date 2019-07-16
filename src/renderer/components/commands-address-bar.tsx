import { Button, InputGroup, Intent } from '@blueprintjs/core';
import classnames from 'classnames';
import { reaction } from 'mobx';
import { observer } from 'mobx-react';
import * as React from 'react';

import { IpcEvents } from '../../ipc-events';
import { idFromUrl, urlFromId } from '../../utils/gist';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';

export interface AddressBarProps {
  appState: AppState;
}

export interface AddressBarState {
  value: string;
  loaders: {
    gist: any;
    example: any;
  };
}

@observer
export class AddressBar extends React.Component<AddressBarProps, AddressBarState> {
  constructor(props: AddressBarProps) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.submit = this.submit.bind(this);

    const { gistId } = this.props.appState;
    const value = gistId ? urlFromId(gistId) : '';

    const { remoteLoader } = window.ElectronFiddle.app;

    this.state = {
      value,
      loaders: {
        gist: remoteLoader.loadFiddleFromGist.bind(remoteLoader),
        example: remoteLoader.loadFiddleFromElectronExample.bind(remoteLoader)
      }
    };
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
    const { remoteLoader } = window.ElectronFiddle.app;
    if (this.state.value) {
      remoteLoader.fetchGistAndLoad(idFromUrl(this.state.value) || this.state.value);
    }
  }

  /**
   * Once the component mounts, we'll subscribe to gistId changes
   */
  public componentDidMount() {
    const { appState } = this.props;
    const { loaders } = this.state;
    reaction(
      () => appState.gistId,
      (gistId: string) => this.setState({ value: urlFromId(gistId) })
    );
    ipcRendererManager.on(IpcEvents.LOAD_GIST_REQUEST, loaders.gist);
    ipcRendererManager.on(IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST, loaders.example);
  }

  public componentWillUnmount() {
    const { loaders } = this.state;
    ipcRendererManager.removeListener(IpcEvents.LOAD_GIST_REQUEST, loaders.gist);
    ipcRendererManager.removeListener(IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST, loaders.example);
  }

  /**
   * Handle the change event, which usually just updates the address bar's value
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ value: event.target.value });
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
}
