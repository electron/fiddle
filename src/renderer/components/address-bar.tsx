import * as React from 'react';
import { reaction } from 'mobx';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../../constants';
import { idFromUrl } from '../../utils/gist';
import { getTitle } from '../../utils/get-title';
import { getOctokit } from '../../utils/octokit';
import { classNames } from '../../utils/classnames';

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

    this.state = {
      value: this.props.appState.gistId
    };
  }

  /**
   * Handle the form's submit event, trying to load whatever
   * URL was entered.
   *
   * @param {React.SyntheticEvent<HTMLFormElement>} event
   * @memberof AddressBar
   */
  public async handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    this.props.appState.gistId = idFromUrl(this.state.value) || this.state.value;
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
      (gistId: string) => this.setState({ value: gistId })
    );
  }

  /**
   * Handle the change event, which usually just updates the address bar's value
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * @memberof AddressBar
   */
  public handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ value: idFromUrl(event.target.value) || event.target.value });
  }

  /**
   * Load a fiddle
   *
   * @returns {Promise<boolean>}
   * @memberof AddressBar
   */
  public async loadFiddle(): Promise<boolean> {
    const { appState } = this.props;

    if (!confirm('Are you sure you want to load a new fiddle, all current progress will be lost?')) {
      return false;
    }

    try {
      const octo = await getOctokit();
      const gist = await octo.gists.get({
        gist_id: appState.gistId,
        id: appState.gistId,
      });

      window.ElectronFiddle.app.setValues({
        html: gist.data.files[INDEX_HTML_NAME].content,
        main: gist.data.files[MAIN_JS_NAME].content,
        renderer: gist.data.files[RENDERER_JS_NAME].content,
      });

      document.title = getTitle(appState);
      appState.localPath = null;
    } catch (error) {
      console.warn(`Loading fiddle failed`, error);
      return false;
    }

    return true;
  }

  public render() {
    const { isUnsaved } = this.props.appState;
    const { value } = this.state;
    const className = classNames('address-bar', isUnsaved, { empty: !value });

    return (
      <form className={className} onSubmit={this.handleSubmit}>
        <span>https://gist.github.com/</span>
        <input
          key='addressbar'
          type='text'
          placeholder='...'
          value={value}
          onChange={this.handleChange}
        />
      </form>
    );
  }
}
