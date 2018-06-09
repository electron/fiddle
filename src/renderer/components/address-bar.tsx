import * as React from 'react';
import { observer } from 'mobx-react';
import * as Octokit from '@octokit/rest';
import * as classNames from 'classnames';

import { AppState } from '../app';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../constants';
import { idFromUrl } from '../../utils/gist';

export interface AddressBarProps {
  appState: AppState;
}

@observer
export class AddressBar extends React.Component<AddressBarProps, {}> {
  constructor(props: AddressBarProps) {
    super(props);

    this.loadFiddle = this.loadFiddle.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  public async handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    this.loadFiddle();
  }

  public async handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.props.appState.gistId = idFromUrl(event.target.value) || event.target.value;
  }

  public async loadFiddle() {
    const { gistId } = this.props.appState;

    if (!confirm('Are you sure you want to load a new fiddle, all current progress will be lost?')) return;

    const octo = new Octokit();
    const gist = await octo.gists.get({
      gist_id: gistId,
      id: gistId,
    });

    window.ElectronFiddle.app.setValues({
      html: gist.data.files[INDEX_HTML_NAME].content,
      main: gist.data.files[MAIN_JS_NAME].content,
      renderer: gist.data.files[RENDERER_JS_NAME].content,
    });
  }

  public render() {
    const { gistId, isUnsaved } = this.props.appState;
    const className = classNames('address-bar', isUnsaved, { empty: !gistId });

    return (
      <form className={className} onSubmit={this.handleSubmit}>
        <span>https://gist.github.com/</span>
        <input
          key='addressbar'
          type='text'
          placeholder='...'
          value={gistId}
          onChange={this.handleChange}
        />
      </form>
    );
  }
}
