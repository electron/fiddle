import {
  Button,
  ButtonGroup,
  Callout,
  Checkbox,
  FormGroup,
  HTMLTable,
  IButtonProps,
  Icon,
  IconName,
  Tooltip,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import {
  ElectronReleaseChannel,
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../interfaces';
import { normalizeVersion } from '../../utils/normalize-version';
import { AppState } from '../state';
import { getReleaseChannel, getOldestSupportedVersion } from '../versions';

interface ElectronSettingsProps {
  appState: AppState;
}

interface ElectronSettingsState {
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
export class ElectronSettings extends React.Component<
  ElectronSettingsProps,
  ElectronSettingsState
> {
  constructor(props: ElectronSettingsProps) {
    super(props);

    this.handleAddVersion = this.handleAddVersion.bind(this);
    this.handleChannelChange = this.handleChannelChange.bind(this);
    this.handleDeleteAll = this.handleDeleteAll.bind(this);
    this.handleDownloadAll = this.handleDownloadAll.bind(this);
    this.handleDownloadClick = this.handleDownloadClick.bind(this);
    this.handleShowObsoleteChange = this.handleShowObsoleteChange.bind(this);
    this.handleStateChange = this.handleStateChange.bind(this);

    this.state = {
      isDownloadingAll: false,
      isDeletingAll: false,
    };
  }

  public handleDownloadClick() {
    this.props.appState.updateElectronVersions();
  }

  /**
   * Handles toggline whether to show undownloaded vesions
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleStateChange(event: React.FormEvent<HTMLInputElement>) {
    const { appState } = this.props;
    const { checked } = event.currentTarget;
    appState.showUndownloadedVersions = checked;
  }

  /**
   * Handles toggline whether to show obsolete vesions
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleShowObsoleteChange(event: React.FormEvent<HTMLInputElement>) {
    const { appState } = this.props;
    const { checked } = event.currentTarget;
    appState.showObsoleteVersions = checked;
  }

  /**
   * Handles a change in which channels should be displayed.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleChannelChange(event: React.FormEvent<HTMLInputElement>) {
    const { id, checked } = event.currentTarget;
    const { appState } = this.props;

    if (!checked) {
      appState.hideChannels([id as ElectronReleaseChannel]);
    } else {
      appState.showChannels([id as ElectronReleaseChannel]);
    }
  }

  /**
   * Download all visible versions of Electron.
   *
   * @returns {Promise<void>}
   */
  public async handleDownloadAll(): Promise<void> {
    this.setState({ isDownloadingAll: true });

    const { downloadVersion, versionsToShow } = this.props.appState;

    for (const { version } of versionsToShow) {
      await downloadVersion(version);
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
      <div className="settings-electron">
        <h2>Electron Settings</h2>
        <Callout>{this.renderVersionShowOptions()}</Callout>
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
          icon="numbered-list"
          text="Update Electron Release List"
        />
        <Button
          disabled={isWorking}
          icon="download"
          onClick={this.handleDownloadAll}
          text="Download All Versions"
        />
        <Button
          disabled={isWorking}
          icon="trash"
          onClick={this.handleDeleteAll}
          text="Delete All Downloads"
        />
        <Button
          icon="document-open"
          onClick={this.handleAddVersion}
          text="Add Local Electron Build"
        />
      </ButtonGroup>
    );
  }

  /**
   * Renders the various options for which versions should be displayed
   *
   * @private
   * @returns {JSX.Element}
   */
  private renderVersionShowOptions(): JSX.Element {
    const { appState } = this.props;

    const getIsChecked = (channel: ElectronReleaseChannel) => {
      return appState.channelsToShow.includes(channel);
    };

    const getIsCurrentVersionReleaseChannel = (
      channel: ElectronReleaseChannel,
    ) => {
      return getReleaseChannel(appState.version) === channel;
    };

    const channels = {
      stable: ElectronReleaseChannel.stable,
      beta: ElectronReleaseChannel.beta,
      nightly: ElectronReleaseChannel.nightly,
    };

    return (
      <FormGroup label="Include Electron versions:">
        {Object.values(channels).map((channel) => (
          <Tooltip
            content={`Can't disable channel of selected version (${appState.version})`}
            disabled={!getIsCurrentVersionReleaseChannel(channel)}
            position="bottom"
            intent="primary"
            key={channel}
          >
            <Checkbox
              checked={getIsChecked(channel)}
              label={channel}
              id={channel}
              onChange={this.handleChannelChange}
              disabled={getIsCurrentVersionReleaseChannel(channel)}
              inline={true}
            />
          </Tooltip>
        ))}
        <Checkbox
          checked={appState.showUndownloadedVersions}
          id="showUndownloadedVersions"
          inline={true}
          label="Not downloaded"
          onChange={this.handleStateChange}
        />
        <Tooltip
          content={`Include versions that have reached end-of-life (older than ${getOldestSupportedVersion()})`}
          position="bottom"
          intent="primary"
        >
          <Checkbox
            checked={appState.showObsoleteVersions}
            id="showObsoleteVersions"
            inline={true}
            label="Obsolete"
            onChange={this.handleShowObsoleteChange}
          />
        </Tooltip>
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
      <HTMLTable className="electron-versions-table" striped={true}>
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th className="action">Action</th>
          </tr>
        </thead>
        <tbody>{this.renderTableRows()}</tbody>
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
    return this.props.appState.versionsToShow.map((item) => (
      <tr key={item.version}>
        <td>{item.version}</td>
        <td>{this.renderHumanState(item)}</td>
        <td className="action">{this.renderAction(item)}</td>
      </tr>
    ));
  }

  /**
   * Returns a human-readable state indicator for an Electron version
   *
   * @param {RunnableVersion} item
   * @returns {JSX.Element}
   */
  private renderHumanState(item: RunnableVersion): JSX.Element {
    const { state } = item;
    let icon: IconName = 'box';
    let humanState = 'Downloaded';

    if (state === VersionState.downloading) {
      icon = 'cloud-download';
      humanState = 'Downloading';
    } else if (state === VersionState.unknown) {
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
   * @param {RunnableVersion} item
   * @returns {JSX.Element}
   */
  private renderAction(ver: RunnableVersion): JSX.Element {
    const { state, source, version } = ver;
    const { appState } = this.props;
    const buttonProps: IButtonProps = {
      fill: true,
      small: true,
    };

    switch (state) {
      case VersionState.ready:
        buttonProps.icon = 'trash';
        buttonProps.onClick = () => appState.removeVersion(version);
        buttonProps.text = source === VersionSource.local ? 'Remove' : 'Delete';
        break;

      case VersionState.downloading:
      case VersionState.unzipping:
        buttonProps.disabled = true;
        buttonProps.icon = 'cloud-download';
        buttonProps.loading = true;
        buttonProps.text = 'Downloading';
        break;

      case VersionState.unknown:
        buttonProps.disabled = false;
        buttonProps.icon = 'cloud-download';
        buttonProps.loading = false;
        buttonProps.onClick = () => appState.downloadVersion(version);
        buttonProps.text = 'Download';
        break;
    }

    return <Button {...buttonProps} type={undefined} />;
  }
}
