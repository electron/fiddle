import { Button, InputGroup, Intent } from '@blueprintjs/core';
import classnames from 'classnames';
import { reaction } from 'mobx';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { EditorMosaic } from '../editor-mosaic';
import { GistActionState } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { getGistId, urlFromId } from '../../utils/gist';
import { ipcRendererManager } from '../ipc';

interface AddressBarProps {
  appState: AppState;
  editorMosaic: EditorMosaic;
}

interface AddressBarState {
  value: string;
  loaders: {
    gist: any;
    example: any;
  };
}

@observer
export class AddressBar extends React.Component<
  AddressBarProps,
  AddressBarState
> {
  constructor(props: AddressBarProps) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.submit = this.submit.bind(this);

    const { gistId } = this.props.appState;
    const value = urlFromId(gistId);

    const { remoteLoader } = window.ElectronFiddle.app;

    this.state = {
      value,
      loaders: {
        gist: remoteLoader.loadFiddleFromGist.bind(remoteLoader),
        example: remoteLoader.loadFiddleFromElectronExample.bind(remoteLoader),
      },
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
    const gistId = getGistId(this.state.value);
    window.ElectronFiddle.app.openFiddle({ gistId });
  }

  /**
   * Once the component mounts, we'll subscribe to gistId changes
   */
  public componentDidMount() {
    const { appState } = this.props;
    const { loaders } = this.state;
    reaction(
      () => appState.gistId,
      (gistId: string) => this.setState({ value: urlFromId(gistId) }),
    );
    ipcRendererManager.on(IpcEvents.LOAD_GIST_REQUEST, loaders.gist);
    ipcRendererManager.on(
      IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST,
      loaders.example,
    );
  }

  public componentWillUnmount() {
    const { loaders } = this.state;
    ipcRendererManager.removeListener(
      IpcEvents.LOAD_GIST_REQUEST,
      loaders.gist,
    );
    ipcRendererManager.removeListener(
      IpcEvents.LOAD_ELECTRON_EXAMPLE_REQUEST,
      loaders.example,
    );
  }

  /**
   * Handle the change event, which usually just updates the address bar's value
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ value: event.target.value });
  }

  /**
   * If the input text is empty when it loses focus,
   * reset it to the current gist
   */
  public handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    if (!event.target.value) {
      this.setState({ value: urlFromId(this.props.appState.gistId) });
    }
  }

  public renderLoadButton(isValueCorrect: boolean): JSX.Element {
    return (
      <Button
        disabled={!isValueCorrect}
        icon="cloud-download"
        text="Load Fiddle"
        onClick={this.submit}
      />
    );
  }

  public render() {
    const { activeGistAction } = this.props.appState;
    const { isEdited } = this.props.editorMosaic;
    const { value } = this.state;
    const isCorrect = !!getGistId(value);
    const className = classnames('address-bar', isEdited, { empty: !value });

    const isPerformingAction = activeGistAction !== GistActionState.none;
    return (
      <form className={className} onSubmit={this.handleSubmit}>
        <fieldset disabled={isPerformingAction}>
          <InputGroup
            key="addressbar"
            leftIcon="geosearch"
            intent={isCorrect || !value ? undefined : Intent.DANGER}
            onChange={this.handleChange}
            onBlur={this.handleBlur}
            placeholder="https://gist.github.com/..."
            value={value}
            rightElement={this.renderLoadButton(isCorrect)}
          />
        </fieldset>
      </form>
    );
  }
}
