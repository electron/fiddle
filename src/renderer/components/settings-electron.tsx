import {
  faClipboardList,
  faCloudDownloadAlt,
  faSpinner,
  faTrash
} from '@fortawesome/fontawesome-free-solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { observer } from 'mobx-react';
import * as React from 'react';

import { ElectronVersion } from '../../interfaces';
import { normalizeVersion } from '../../utils/normalize-version';
import { sortedElectronMap } from '../../utils/sorted-electron-map';
import { AppState } from '../state';
import { ElectronReleaseChannel, getReleaseChannel } from '../versions';

export interface ElectronSettingsProps {
  appState: AppState;
}

export interface ElectronSettingsState {
  isDownloadingAll: boolean;
  isDeletingAll: boolean;
}

/**
 * Settings content to manage Electron-related preferences.
 *
 * @class ElectronSettings
 * @extends {React.Component<ElectronSettingsProps, {}>}
 */
@observer
export class ElectronSettings extends React.Component<ElectronSettingsProps, ElectronSettingsState> {
  constructor(props: ElectronSettingsProps) {
    super(props);

    this.handleDownloadAll = this.handleDownloadAll.bind(this);
    this.handleDeleteAll = this.handleDeleteAll.bind(this);
    this.handleChannelChange = this.handleChannelChange.bind(this);
    this.handlePagesChange = this.handlePagesChange.bind(this);
    this.handleDownloadClick = this.handleDownloadClick.bind(this);

    this.state = {
      isDownloadingAll: false,
      isDeletingAll: false
    };
  }

  public handleDownloadClick() {
    this.props.appState.updateElectronVersions();
  }

  /**
   * Handles a change in how many pages should be displayed.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  public handlePagesChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const { value } = event.currentTarget;
    this.props.appState.versionPagesToFetch = parseInt(value, 10) / 30;
  }

  /**
   * Handles a change in which channels should be displayed.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleChannelChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const { id, checked } = event.currentTarget;
    const { appState } = this.props;

    if (!checked) {
      appState.versionsToShow = appState.versionsToShow.filter((c) => c !== id);
    } else {
      appState.versionsToShow.push(id as ElectronReleaseChannel);
    }
  }

  /**
   * Download all versions of Electron.
   *
   * @returns {Promise<void>}
   */
  public async handleDownloadAll(): Promise<void> {
    this.setState({ isDownloadingAll: true });

    const { versions, downloadVersion } = this.props.appState;

    for (const key of Object.keys(versions)) {
      await downloadVersion(key);
    }

    this.setState({ isDownloadingAll: false });
  }

  /**
   * Delete all downloaded versions of Electron.
   *
   * @returns {Promise<void>}
   */
  public async handleDeleteAll(): Promise<void> {
    this.setState({ isDeletingAll: true });

    const { versions, removeVersion, version } = this.props.appState;

    for (const key in versions) {
      // If this isn't the currently selected version, remove it
      if (normalizeVersion(key) !== normalizeVersion(version)) {
        await removeVersion(key);
      }
    }

    this.setState({ isDeletingAll: false });
  }

  public render() {
    const { isDownloadingAll, isDeletingAll } = this.state;
    const isWorking = isDownloadingAll || isDeletingAll;
    const downloadFontAwesomeIcon = isDownloadingAll
      ? <FontAwesomeIcon icon={faSpinner} spin={true} />
      : <FontAwesomeIcon icon={faCloudDownloadAlt} />;
    const deleteFontAwesomeIcon = isDeletingAll
      ? <FontAwesomeIcon icon={faSpinner} spin={true} />
      : <FontAwesomeIcon icon={faTrash} />;

    return (
      <div className='settings-electron'>
        <h2>Electron Settings</h2>
        <div className='advanced-options settings-section'>
          {this.renderVersionOptions()}

          <label>Download all versions of Electron.</label>
          <button
            className='button btn-download-all'
            disabled={isWorking}
            onClick={this.handleDownloadAll}
          >
            {downloadFontAwesomeIcon} Download All Versions
          </button>
          <label>Remove all downloaded versions of Electron.</label>
          <button
            className='button btn-delete-all'
            disabled={isWorking}
            onClick={this.handleDeleteAll}
          >
            {deleteFontAwesomeIcon} Delete All Versions
          </button>
        </div>
        <div>
          <h2>Versions</h2>
          {this.renderTable()}
        </div>
      </div>
    );
  }

  private renderVersionOptions(): JSX.Element {
    const { appState } = this.props;
    const getIsChecked = (channel: ElectronReleaseChannel) => {
      return appState.versionsToShow.includes(channel);
    };

    return (
      <div className='versions-to-show'>
        <p>Include Electron versions from these release channels:</p>
        <label>
          <input
            checked={getIsChecked(ElectronReleaseChannel.stable)}
            id={ElectronReleaseChannel.stable}
            type='checkbox'
            onChange={this.handleChannelChange}
          />
          Stable
        </label>
        <label>
          <input
            checked={getIsChecked(ElectronReleaseChannel.beta)}
            id={ElectronReleaseChannel.beta}
            type='checkbox'
            onChange={this.handleChannelChange}
          />
          Beta
        </label>
        <label>
          <input
            checked={getIsChecked(ElectronReleaseChannel.nightly)}
            id={ElectronReleaseChannel.nightly}
            type='checkbox'
            onChange={this.handleChannelChange}
          />
          Nightly
        </label>
        <label>
          <input
            checked={getIsChecked(ElectronReleaseChannel.unsupported)}
            id={ElectronReleaseChannel.unsupported}
            type='checkbox'
            onChange={this.handleChannelChange}
          />
          Unsupported
        </label>
        <p>Number of recent Electron releases to include:</p>
        <select onChange={this.handlePagesChange}>
          <option value='1'>30</option>
          <option value='2'>60</option>
          <option value='3'>90</option>
          <option value='4'>120</option>
          <option value='5'>150</option>
          <option value='6'>180</option>
          <option value='7'>210</option>
          <option value='8'>240</option>
          <option value='9'>270</option>
          <option value='10'>300</option>
        </select>
        <br />
        {this.renderUpdateVersionsButton()}
      </div>
    );
  }

  private renderUpdateVersionsButton(): JSX.Element {
    const { appState } = this.props;
    const { isUpdatingElectronVersions } = appState;
    const icon = isUpdatingElectronVersions
      ? <FontAwesomeIcon icon={faSpinner} spin={true}/>
      : <FontAwesomeIcon icon={faClipboardList} />;

    return (
      <button
        className='button'
        disabled={isUpdatingElectronVersions}
        onClick={this.handleDownloadClick}
      >
        {icon} Update Electron Release List
      </button>
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
  private renderTableRows(): Array<JSX.Element | null> {
    const { versions, versionsToShow } = this.props.appState;

    return sortedElectronMap<JSX.Element | null>(versions, (key, item) => {
      // Check if we want to show the version
      if (!versionsToShow.includes(getReleaseChannel(item))) {
        return null;
      }

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
        <button className='button' onClick={remove}>
          <FontAwesomeIcon icon={faTrash} /> Delete
        </button>
      );
    }

    // Downloading
    if (state === 'downloading') {
      return (
        <button className='button' disabled={true}>
          <FontAwesomeIcon icon={faSpinner} spin={true}/> Downloading
        </button>
      );
    }

    // Unknown
    const download = () => appState.setVersion(key);

    return (
      <button className='button' onClick={download}>
        <FontAwesomeIcon icon={faCloudDownloadAlt} /> Download
      </button>
    );
  }
}
