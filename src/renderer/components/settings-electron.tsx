import * as React from 'react';

import {
  AnchorButton,
  Button,
  ButtonGroup,
  ButtonProps,
  Callout,
  Checkbox,
  FormGroup,
  Icon,
  IconName,
  InputGroup,
  Spinner,
} from '@blueprintjs/core';
import { Tooltip2 } from '@blueprintjs/popover2';
import { observer } from 'mobx-react';
import { FixedSizeList as List } from 'react-window';

import {
  ElectronReleaseChannel,
  InstallState,
  RunnableVersion,
  VersionSource,
} from '../../interfaces';
import { AppState } from '../state';
import { disableDownload } from '../utils/disable-download';
import { getReleaseChannel } from '../versions';

interface ElectronSettingsProps {
  appState: AppState;
}

interface ElectronSettingsState {
  filterQuery: string;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    versions: RunnableVersion[];
    appState: AppState;
  };
}

// Observer component for individual rows to ensure they re-render when version state changes
const ElectronVersionRow = observer(({ index, style, data }: RowProps) => {
  const { versions, appState } = data;
  const item = versions[index];

  const renderHumanState = (item: RunnableVersion): JSX.Element => {
    const { state, source } = item;
    const isLocal = source === VersionSource.local;
    let icon: IconName = 'box';
    let humanState = isLocal ? 'Available' : 'Downloaded';

    if (state === InstallState.downloading) {
      icon = 'cloud-download';
      humanState = 'Downloading';
    } else if (state === InstallState.missing) {
      icon = isLocal ? 'issue' : 'cloud';
      humanState = isLocal ? 'Not Available' : 'Not Downloaded';
    }

    return (
      <span>
        <Icon icon={icon} /> {humanState}
      </span>
    );
  };

  const renderAction = (ver: RunnableVersion): JSX.Element => {
    const { state, source, version } = ver;
    const isLocal = source === VersionSource.local;
    const buttonProps: ButtonProps = {
      small: true,
    };

    switch (state) {
      case InstallState.installed:
      case InstallState.downloaded:
        buttonProps.icon = 'trash';
        buttonProps.onClick = () => appState.removeVersion(ver);
        buttonProps.text = isLocal ? 'Remove' : 'Delete';
        break;

      case InstallState.installing:
      case InstallState.downloading:
        buttonProps.disabled = true;
        buttonProps.icon = <Spinner size={16} value={ver.downloadProgress} />;
        buttonProps.text = 'Downloading';
        buttonProps.className = 'disabled-version';
        break;

      case InstallState.missing:
        buttonProps.disabled = false;
        buttonProps.loading = false;
        buttonProps.icon = isLocal ? 'trash' : 'cloud-download';
        buttonProps.text = isLocal ? 'Remove' : 'Download';
        buttonProps.onClick = () => {
          isLocal ? appState.removeVersion(ver) : appState.downloadVersion(ver);
        };
        break;
    }

    if (version === appState.currentElectronVersion.version) {
      return (
        <Tooltip2
          position="auto"
          intent="primary"
          content={`Can't remove currently active Electron version (${version})`}
        >
          <AnchorButton
            className={'disabled-version'}
            disabled={true}
            text={buttonProps.text}
            icon={buttonProps.icon}
          />
        </Tooltip2>
      );
    } else if (disableDownload(version)) {
      return (
        <Tooltip2
          position="auto"
          intent="primary"
          content={`Version is not available on your current OS`}
        >
          <AnchorButton
            className={'disabled-version'}
            disabled={true}
            text={buttonProps.text}
            icon={buttonProps.icon}
          />
        </Tooltip2>
      );
    }

    return <Button {...buttonProps} type={undefined} />;
  };

  return (
    <div
      className={`electron-version-row ${index % 2 === 0 ? 'even' : 'odd'}`}
      style={style}
    >
      <div className="version-col">{item.version}</div>
      <div className="status-col">{renderHumanState(item)}</div>
      <div className="action-col">{renderAction(item)}</div>
    </div>
  );
});

/**
 * Settings content to manage Electron-related preferences.
 */
export const ElectronSettings = observer(
  class ElectronSettings extends React.Component<
    ElectronSettingsProps,
    ElectronSettingsState
  > {
    constructor(props: ElectronSettingsProps) {
      super(props);

      this.state = {
        filterQuery: '',
      };

      this.handleAddVersion = this.handleAddVersion.bind(this);
      this.handleChannelChange = this.handleChannelChange.bind(this);
      this.handleDeleteAll = this.handleDeleteAll.bind(this);
      this.handleDownloadAll = this.handleDownloadAll.bind(this);
      this.handleStopDownloads = this.handleStopDownloads.bind(this);
      this.handleUpdateElectronVersions =
        this.handleUpdateElectronVersions.bind(this);
      this.handleShowObsoleteChange = this.handleShowObsoleteChange.bind(this);
      this.handleStateChange = this.handleStateChange.bind(this);
      this.handleFilterChange = this.handleFilterChange.bind(this);
    }

    public handleUpdateElectronVersions() {
      this.props.appState.updateElectronVersions();
    }

    /**
     * Toggles visibility of non-downloaded versions
     */
    public handleStateChange(event: React.FormEvent<HTMLInputElement>) {
      const { appState } = this.props;
      const { checked } = event.currentTarget;
      appState.showUndownloadedVersions = checked;
    }

    /**
     * Toggles visibility of obsolete versions
     */
    public handleShowObsoleteChange(event: React.FormEvent<HTMLInputElement>) {
      const { appState } = this.props;
      const { checked } = event.currentTarget;
      appState.showObsoleteVersions = checked;
    }

    /**
     * Handles a change in which channels should be displayed.
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
     */
    public async handleDownloadAll(): Promise<void> {
      const {
        downloadVersion,
        versionsToShow,
        startDownloadingAll,
        stopDownloadingAll,
      } = this.props.appState;

      startDownloadingAll();

      for (const ver of versionsToShow) {
        await downloadVersion(ver);

        if (!this.props.appState.isDownloadingAll) break;
      }

      stopDownloadingAll();
    }

    /**
     * Delete all downloaded versions of Electron.
     */
    public async handleDeleteAll(): Promise<void> {
      const { versions, removeVersion, startDeletingAll, stopDeletingAll } =
        this.props.appState;

      startDeletingAll();

      for (const ver of Object.values(versions)) {
        await removeVersion(ver);
      }

      stopDeletingAll();
    }

    /**
     * Stops the downloads
     */
    public handleStopDownloads = (): void => {
      this.props.appState.stopDownloadingAll();
    };

    /**
     * Opens the "add local version" dialog
     */
    public handleAddVersion(): void {
      this.props.appState.toggleAddVersionDialog();
    }

    private handleFilterChange(event: React.ChangeEvent<HTMLInputElement>) {
      this.setState({ filterQuery: event.target.value });
    }

    private get filteredVersions(): RunnableVersion[] {
      const { filterQuery } = this.state;
      const { versionsToShow } = this.props.appState;

      if (!filterQuery) return versionsToShow;

      const query = filterQuery.toLowerCase();
      return versionsToShow.filter((ver) =>
        ver.version.toLowerCase().includes(query),
      );
    }

    public render() {
      return (
        <div className="settings-electron">
          <h1>Electron Settings</h1>
          <Callout>{this.renderFilters()}</Callout>
          <br />
          <Callout>
            {this.renderAdvancedButtons()}
            {this.renderVersionFilter()}
            {this.renderVersionsTable()}
          </Callout>
        </div>
      );
    }

    /**
     * Renders the various buttons for advanced operations.
     */
    private renderAdvancedButtons(): JSX.Element {
      const { isUpdatingElectronVersions, isDownloadingAll, isDeletingAll } =
        this.props.appState;

      const isWorking = isDownloadingAll || isDeletingAll;

      return (
        <ButtonGroup fill={true}>
          <Button
            disabled={isUpdatingElectronVersions}
            onClick={this.handleUpdateElectronVersions}
            loading={isUpdatingElectronVersions}
            icon="numbered-list"
            text="Update Electron Release List"
          />
          {isDownloadingAll ? (
            <Button
              icon="stop"
              onClick={this.handleStopDownloads}
              text="Stop Downloads"
            />
          ) : (
            <Button
              disabled={isWorking}
              icon="download"
              onClick={this.handleDownloadAll}
              text="Download All Versions"
            />
          )}
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
     * Renders the filters section with channels and visibility options.
     */
    private renderFilters(): JSX.Element {
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
        <FormGroup>
          <div style={{ marginBottom: '8px' }}>
            <label
              style={{
                fontWeight: 'bold',
                marginBottom: '4px',
                display: 'block',
              }}
            >
              Channels
            </label>
            {Object.values(channels).map((channel) => (
              <Tooltip2
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
              </Tooltip2>
            ))}
          </div>

          <div>
            <label
              style={{
                fontWeight: 'bold',
                marginBottom: '4px',
                display: 'block',
              }}
            >
              Visibility
            </label>
            <Checkbox
              checked={appState.showUndownloadedVersions}
              id="showUndownloadedVersions"
              label="Show not downloaded versions"
              onChange={this.handleStateChange}
              inline={true}
            />
            <Tooltip2
              content={`Include versions that have reached end-of-life (older than ${window.ElectronFiddle.getOldestSupportedMajor()}.0.0)`}
              position="bottom"
              intent="primary"
            >
              <Checkbox
                checked={appState.showObsoleteVersions}
                id="showObsoleteVersions"
                inline={true}
                label="Show obsolete versions"
                onChange={this.handleShowObsoleteChange}
              />
            </Tooltip2>
          </div>
        </FormGroup>
      );
    }

    /**
     * Renders the version filter input.
     */
    private renderVersionFilter(): JSX.Element {
      return (
        <InputGroup
          className="version-filter"
          leftIcon="filter"
          placeholder="Filter versions..."
          value={this.state.filterQuery}
          onChange={this.handleFilterChange}
        />
      );
    }

    /**
     * Renders the table with Electron versions.
     */
    private renderVersionsTable(): JSX.Element {
      const versions = this.filteredVersions;
      const itemData = {
        versions,
        appState: this.props.appState,
      };

      return (
        <div className="electron-versions-table">
          <div className="electron-versions-header">
            <div className="version-col">Version</div>
            <div className="status-col">Status</div>
            <div className="action-col">Action</div>
          </div>
          {versions.length === 0 ? (
            <div className="no-versions">No versions match your filter</div>
          ) : (
            <List
              height={400}
              itemCount={versions.length}
              itemSize={40}
              width="100%"
              itemData={itemData}
              className="electron-versions-list"
            >
              {ElectronVersionRow}
            </List>
          )}
        </div>
      );
    }
  },
);
