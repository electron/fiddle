import * as React from 'react';
import * as semver from 'semver';
import { observer } from 'mobx-react';

import { normalizeVersion } from '../../utils/normalize-version';
import { AppState } from '../app';
import { updateEditorTypeDefinitions } from '../fetch-types';

export interface VersionChooserState {
  value: string;
}

export interface VersionChooserProps {
  appState: AppState;
}

@observer
export class VersionChooser extends React.Component<VersionChooserProps, VersionChooserState> {
  constructor(props: VersionChooserProps) {
    super(props);

    this.handleChange = this.handleChange.bind(this);
    this.handleVersionChange(this.props.appState.version);
  }

  public async updateDownloadedVersionState() {
    const { binaryManager } = this.props.appState;
    const downloadedVersions = await binaryManager.getDownloadedVersions();
    const updatedVersions = { ...this.props.appState.versions };

    console.log(`Version Chooser: Updating version state`);
    downloadedVersions.forEach((version) => {
      if (updatedVersions[version]) {
        updatedVersions[version].state = 'ready';
      }
    });

    this.props.appState.versions = updatedVersions;
  }

  public handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const version = normalizeVersion(event.target.value);
    this.handleVersionChange(version);
  }

  public handleVersionChange(version: string) {
    console.log(`Version Chooser: Switching to v${version}`);

    this.props.appState.version = version;

    // Update TypeScript definitions
    updateEditorTypeDefinitions(version);

    // Fetch new binaries, maybe?
    if ((this.props.appState.versions[version] || { state: '' }).state === 'ready') return;

    console.log(`Version Chooser: Instructing BinaryManager to fetch v${version}`);
    const updatedVersions = { ...this.props.appState.versions };
    updatedVersions[normalizeVersion(version)].state = 'downloading';
    this.props.appState.versions = updatedVersions;

    this.props.appState.binaryManager.setup(version)
      .then(() => this.updateDownloadedVersionState());
  }

  public renderOptions() {
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
