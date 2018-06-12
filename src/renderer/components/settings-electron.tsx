import * as React from 'react';
import * as Icon from '@fortawesome/react-fontawesome';
import { faTrash, faCloudDownloadAlt } from '@fortawesome/fontawesome-free-solid';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { sortedElectronMap } from '../../utils/sorted-electron-map';
import { ElectronVersion } from '../../interfaces';

export interface ElectronSettingsProps {
  appState: AppState;
}

/**
 * Everything above the editors, so buttons and the address bar.
 *
 * @class ElectronSettings
 * @extends {React.Component<ElectronSettingsProps, {}>}
 */
@observer
export class ElectronSettings extends React.Component<ElectronSettingsProps, {}> {
  public render() {
    return (
      <div className='settings-electron'>
        <h2>Electron Settings</h2>
        <div className='advanced-options settings-section'>
          <label>Download all versions of Electron.</label>
          <button className='button'>
            <Icon icon={faCloudDownloadAlt} /> Download All Versions
          </button>
          <label>Remove all downloaded versions of Electron.</label>
          <button className='button'>
            <Icon icon={faTrash} /> Delete All Versions
          </button>
        </div>
        <div>
          <h2>Versions</h2>
          {this.renderTable()}
        </div>
      </div>
    );
  }

  /**
   * Renders the table with Electron versions.
   *
   * @private
   * @returns {JSX.Element}
   */
  private renderTable(): JSX.Element {
    return (
      <table className='electron-versions-table'>
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th className='action'>Action</th>
          </tr>
        </thead>
        <tbody>
          {this.renderTableRows()}
        </tbody>
      </table>
    );
  }

  /**
   * Renders the rows with Electron version, returning an Arary.
   *
   * @private
   * @returns {Array<JSX.Element>}
   */
  private renderTableRows(): Array<JSX.Element> {
    const { versions } = this.props.appState;

    return sortedElectronMap<JSX.Element>(versions, (key, item) => {
      const { tag_name, state } = item;
      const humanState = state === 'ready'
        ? '✅ Downloaded'
        : state === 'downloading' ? '⏬ Downloading' : '⏹ Not downloaded';

      return (
        <tr key={tag_name}>
          <td>{tag_name}</td>
          <td>{humanState}</td>
          <td>{this.renderAction(key, item)}</td>
        </tr>
      );
    });
  }

  /**
   * Renders the action for a single Electron version
   *
   * @private
   * @param {string} key
   * @param {ElectronVersion} item
   * @returns {JSX.Element}
   */
  private renderAction(key: string, item: ElectronVersion): JSX.Element {
    const { state } = item;
    const { appState } = this.props;

    // Already downloaded
    if (state === 'ready') {
      const remove = () => appState.removeVersion(key);

      return (
        <button className='button button-clear' onClick={remove}>
          <Icon icon={faTrash} /> Delete
        </button>
      );
    }

    // Downloading
    if (state === 'downloading') {
      return (
        <button className='button button-clear' disabled={true}>
          <Icon icon={faCloudDownloadAlt} spin={true}/> Downloading
        </button>
      );
    }

    // Unknown
    const download = () => appState.setVersion(key);

    return (
      <button className='button button-clear' onClick={download}>
        <Icon icon={faCloudDownloadAlt} /> Download
      </button>
    );
  }
}
