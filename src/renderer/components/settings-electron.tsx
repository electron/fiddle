import {
  Button,
  ButtonGroup,
  Callout,
  Checkbox,
  FormGroup,
  HTMLTable,
  IButtonProps,
  Icon,
  IconName
} from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { ElectronVersion, ElectronVersionSource, ElectronVersionState } from '../../interfaces';
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
    this.handleStateChange = this.handleStateChange.bind(this);
    this.handleDownloadClick = this.handleDownloadClick.bind(this);
    this.handleAddVersion = this.handleAddVersion.bind(this);

    this.state = {
      isDownloadingAll: false,
      isDeletingAll: false
    };
  }

  public handleDownloadClick() {
    this.props.appState.updateElectronVersions();
  }

  /**
   * Handles a change in which channels should be displayed.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleStateChange(
    event: React.FormEvent<HTMLInputElement>
  ) {
    const { id, checked } = event.currentTarget;
    const { appState } = this.props;

    if (!checked) {
      appState.statesToShow = appState.statesToShow.filter((s) => s !== id);
    } else {
      appState.statesToShow.push(id as ElectronVersionState);
    }
  }

  /**
   * Handles a change in which channels should be displayed.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleChannelChange(
    event: React.FormEvent<HTMLInputElement>
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

  /**
   * Opens the "add local version" dialog
   */
  public handleAddVersion(): void {
    this.props.appState.toggleAddVersionDialog();
  }

  public render() {
    return (
      <div className='settings-electron'>
        <h2>Electron Settings</h2>
        <Callout>
          {this.renderVersionChannelOptions()}
          {this.renderVersionStateOptions()}
        </Callout>
        <br />
        <Callout>
          {this.renderAdvancedButtons()}
          {this.renderTable()}
        </Callout>
      </div>
    );
  }

  /**
   * Renders the various buttons for advanced operations
   *
   * @private
   * @returns {JSX.Element}
   */
  private renderAdvancedButtons(): JSX.Element {
    const { isDownloadingAll, isDeletingAll } = this.state;
    const { isUpdatingElectronVersions } = this.props.appState;
    const isWorking = isDownloadingAll || isDeletingAll;

    return (
      <ButtonGroup fill={true}>
        <Button
          disabled={isUpdatingElectronVersions}
          onClick={this.handleDownloadClick}
          loading={isUpdatingElectronVersions}
          icon='numbered-list'
          text='Update Electron Release List'
        />
        <Button
          disabled={isWorking}
          icon='download'
          onClick={this.handleDownloadAll}
          text='Download All Versions'
        />
        <Button
          disabled={isWorking}
          icon='trash'
          onClick={this.handleDeleteAll}
          text='Delete All Downloads'
        />
        <Button
          icon='document-open'
          onClick={this.handleAddVersion}
          text='Add Local Electron Build'
        />
      </ButtonGroup>
    );
  }

  /**
   * Renders the various options for which versions should be displayed
   * in the small dropdown.
   *
   * @private
   * @returns {JSX.Element}
   */
  private renderVersionStateOptions(): JSX.Element {
    const { appState } = this.props;
    const getIsChecked = (state: ElectronVersionState) => {
      return appState.statesToShow.includes(state);
    };

    return (
      <FormGroup
        label='Include Electron versions that are:'
      >
        <Checkbox
          checked={getIsChecked(ElectronVersionState.downloading)}
          label='Downloading'
          id='downloading'
          onChange={this.handleStateChange}
          inline={true}
        />
        <Checkbox
          checked={getIsChecked(ElectronVersionState.ready)}
          label='Downloaded'
          id='ready'
          onChange={this.handleStateChange}
          inline={true}
        />
        <Checkbox
          checked={getIsChecked(ElectronVersionState.unknown)}
          label='Not Downloaded'
          id='unknown'
          onChange={this.handleStateChange}
          inline={true}
        />
      </FormGroup>
    );
  }

  /**
   * Renders the various options for which versions should be displayed
   *
   * @private
   * @returns {JSX.Element}
   */
  private renderVersionChannelOptions(): JSX.Element {
    const { appState } = this.props;
    const getIsChecked = (channel: ElectronReleaseChannel) => {
      return appState.versionsToShow.includes(channel);
    };

    return (
      <FormGroup
        label='Include Electron versions from these release channels:'
      >
        <Checkbox
          checked={getIsChecked(ElectronReleaseChannel.stable)}
          label='Stable'
          id='Stable'
          onChange={this.handleChannelChange}
          inline={true}
        />
        <Checkbox
          checked={getIsChecked(ElectronReleaseChannel.beta)}
          label='Beta'
          id='Beta'
          onChange={this.handleChannelChange}
          inline={true}
        />
        <Checkbox
          checked={getIsChecked(ElectronReleaseChannel.nightly)}
          label='Nightly'
          id='Nightly'
          onChange={this.handleChannelChange}
          inline={true}
        />
        <Checkbox
          checked={getIsChecked(ElectronReleaseChannel.unsupported)}
          label='Unsupported'
          id='Unsupported'
          onChange={this.handleChannelChange}
          inline={true}
        />
      </FormGroup>
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
      <HTMLTable
        className='electron-versions-table'
        striped={true}
      >
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
      </HTMLTable>
    );
  }

  /**
   * Renders the rows with Electron version, returning an Arary.
   *
   * @private
   * @returns {Array<JSX.Element>}
   */
  private renderTableRows(): Array<JSX.Element | null> {
    const { versions, versionsToShow, statesToShow } = this.props.appState;

    return sortedElectronMap<JSX.Element | null>(versions, (key, item) => {
      // Check if we want to show the version
      if (!versionsToShow.includes(getReleaseChannel(item))) {
        return null;
      }

      // Check if we want to show the state
      if (!statesToShow.includes(item.state)) {
        return null;
      }

      return (
        <tr key={item.version}>
          <td>{item.version}</td>
          <td>{this.renderHumanState(item)}</td>
          <td className='action'>{this.renderAction(key, item)}</td>
        </tr>
      );
    });
  }

  /**
   * Returns a human-readable state indicator for an Electron version
   *
   * @param {ElectronVersion} item
   * @returns {JSX.Element}
   */
  private renderHumanState(item: ElectronVersion): JSX.Element {
    const { state } = item;
    let icon: IconName = 'box';
    let humanState = 'Downloaded';

    if (state === ElectronVersionState.downloading) {
      icon = 'cloud-download';
      humanState = 'Downloading';
    } else if (state === ElectronVersionState.unknown) {
      icon = 'cloud';
      humanState = 'Not downloaded';
    }

    return (
      <span>
        <Icon icon={icon} /> {humanState}
      </span>
    );
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
    const { state, source } = item;
    const { appState } = this.props;
    const buttonProps: IButtonProps = {
      fill: true,
      small: true
    };

    // Already downloaded
    if (state === 'ready') {
      buttonProps.onClick = () => appState.removeVersion(key);
      buttonProps.icon = 'trash';
      buttonProps.text = source === ElectronVersionSource.local
        ? 'Remove'
        : 'Delete';
    } else if (state === 'downloading') {
      buttonProps.disabled = true;
      buttonProps.loading = true;
      buttonProps.text = 'Downloading';
      buttonProps.icon = 'cloud-download';
    } else {
      buttonProps.disabled = false;
      buttonProps.loading = false;
      buttonProps.text = 'Download';
      buttonProps.icon = 'cloud-download';
      buttonProps.onClick = () => appState.downloadVersion(key);
    }

    return <Button {...buttonProps} type={undefined} />;
  }
}
