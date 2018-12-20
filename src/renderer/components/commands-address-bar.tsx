import { Button, InputGroup, Intent } from '@blueprintjs/core';
import { reaction } from 'mobx';
import { observer } from 'mobx-react';
import * as React from 'react';

import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../../constants';
import { classNames } from '../../utils/classnames';
import { getTitle } from '../../utils/get-title';
import { idFromUrl, urlFromId } from '../../utils/gist';
import { getOctokit } from '../../utils/octokit';
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

    this.loadFiddle = this.loadFiddle.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);

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
  public async handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    this.props.appState.gistId = idFromUrl(this.state.value) || this.state.value;

    console.log('Loading');

    if (this.state.value) {
      this.loadFiddle();
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
   * Load a fiddle
   *
   * @returns {Promise<boolean>}
   * @memberof AddressBar
   */
  public async loadFiddle(): Promise<boolean> {
    const { appState } = this.props;

    try {
      const octo = await getOctokit();
      const gist = await octo.gists.get({
        gist_id: appState.gistId
      });

      this.props.appState.setWarningDialogTexts({
        label: 'Loading the fiddle will replace your current unsaved changes. Do you want to discard them?'
      });

      await window.ElectronFiddle.app.setValues({
        html: gist.data.files[INDEX_HTML_NAME].content,
        main: gist.data.files[MAIN_JS_NAME].content,
        renderer: gist.data.files[RENDERER_JS_NAME].content,
      });

      document.title = getTitle(appState);
      appState.localPath = null;
    } catch (error) {
      console.warn(`Loading Fiddle failed`, error);
      return false;
    }

    return true;
  }

  public renderLoadButton(isValueCorrect: boolean): JSX.Element {
    return (
      <Button
        disabled={!isValueCorrect}
        icon='cloud-download'
        text='Load Fiddle'
        onClick={this.loadFiddle}
      />
    );
  }

  public render() {
    const { isUnsaved } = this.props.appState;
    const { value } = this.state;
    const isCorrect = /https:\/\/gist\.github\.com\/(.+)$/.test(value);
    const className = classNames('address-bar', isUnsaved, { empty: !value });

    return (
      <form className={className} onSubmit={this.handleSubmit}>
        <InputGroup
          key='addressbar'
          leftIcon='geosearch'
          intent={isCorrect || !value ? undefined : Intent.DANGER}
          onChange={this.handleChange}
          placeholder='https://gist.github.com/...'
          value={value}
          rightElement={this.renderLoadButton(isCorrect)}
        />
      </form>
    );
  }
}
