import * as React from 'react';
import * as semver from 'semver';
import { observer } from 'mobx-react';

import { AppState } from '../state';

export interface VersionChooserState {
  value: string;
}

export interface VersionChooserProps {
  appState: AppState;
}

/**
 * A dropdown allowing the selection of Electron versions. The actual
 * download is managed in the state.
 *
 * @class VersionChooser
 * @extends {React.Component<VersionChooserProps, VersionChooserState>}
 */
@observer
export class VersionChooser extends React.Component<VersionChooserProps, VersionChooserState> {
  constructor(props: VersionChooserProps) {
    super(props);

    this.handleChange = this.handleChange.bind(this);
  }

  /**
   * Handle change, which usually means that we'd like update
   * the selection version.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  public handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    this.props.appState.setVersion(event.target.value);
  }

  /**
   * Renders the individual options (Electron versions)
   *
   * @returns {Array<JSX.Element>}
   */
  public renderOptions(): Array<JSX.Element> {
    const { versions } = this.props.appState;

    return Object.keys(versions)
      .sort((a, b) => semver.gt(a, b, true) ? -1 : 1)
      .map((key) => {
        const { tag_name, state } = versions[key];
        const version = tag_name;
        const icon = state === 'ready'
          ? '✅'
          : state === 'downloading' ? '⏬' : '⏹';

        return (
          <option value={version} key={version}>
            {icon} {version}
          </option>
        );
      });
  }

  public render() {
    return (
      <select value={`v${this.props.appState.version}`} onChange={this.handleChange}>
        {this.renderOptions()}
      </select>
    );
  }
}
