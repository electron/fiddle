import { observer } from 'mobx-react';
import * as React from 'react';

import { sortedElectronMap } from '../../utils/sorted-electron-map';
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

    return sortedElectronMap<JSX.Element>(versions, (_key, item) => {
      const { tag_name, state } = item;
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
      <select
        className='select-versions'
        value={`v${this.props.appState.version}`}
        onChange={this.handleChange}
      >
        {this.renderOptions()}
      </select>
    );
  }
}
