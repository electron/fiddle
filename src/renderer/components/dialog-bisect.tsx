import { Button, Dialog, Label, MenuItem } from '@blueprintjs/core';
import { Select } from '@blueprintjs/select';
import { observer } from 'mobx-react';
import * as React from 'react';

import { ElectronVersion } from '../../interfaces';
import { Bisector } from '../bisect';
import { AppState } from '../state';
import { filterItem, getItemIcon, getVersionsFromAppState, renderItem } from './commands-version-chooser';

const ElectronVersionSelect = Select.ofType<ElectronVersion>();

export interface BisectDialogProps {
  appState: AppState;
}

export interface BisectDialogState {
  startIndex?: number;
  endIndex?: number;
  allVersions: Array<ElectronVersion>;
}

/**
 * The "add version" dialog allows users to add custom builds of Electron.
 *
 * @class AddVersionDialog
 * @extends {React.Component<BisectDialogProps, BisectDialogState>}
 */
@observer
export class BisectDialog extends React.Component<BisectDialogProps, BisectDialogState> {
  constructor(props: BisectDialogProps) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onBeginSelect = this.onBeginSelect.bind(this);
    this.onEndSelect = this.onEndSelect.bind(this);

    const allVersions = getVersionsFromAppState(this.props.appState);
    this.state = { allVersions };
  }

  public onBeginSelect(version: ElectronVersion) {
    this.setState({ startIndex: this.state.allVersions.indexOf(version) });
  }

  public onEndSelect(version: ElectronVersion) {
    this.setState({ endIndex: this.state.allVersions.indexOf(version) });
  }

  /**
   * Handles the submission of the dialog
   *
   * @returns {Promise<void>}
   */
  public async onSubmit(): Promise<void> {
    const { endIndex, startIndex, allVersions } = this.state;
    const { appState } = this.props;

    if (endIndex === undefined || startIndex === undefined) {
      return;
    }

    const bisectRange = allVersions
      .slice(endIndex, startIndex + 1)
      .reverse();

    appState.Bisector = new Bisector(bisectRange);
    const initialBisectPivot = appState.Bisector.getCurrentVersion().version;
    appState.setVersion(initialBisectPivot);
    this.onClose();
  }

  /**
   * Closes the dialog
   */
  public onClose() {
    this.props.appState.isBisectDialogShowing = false;
  }

  get buttons() {
    const canSubmit =
      !!this.state.startIndex &&
      !!this.state.endIndex &&
      this.state.startIndex > this.state.endIndex;

    return [
      (
        <Button
          icon='play'
          key='submit'
          disabled={!canSubmit}
          onClick={this.onSubmit}
          text='Begin'
        />
      ), (
        <Button
          icon='cross'
          key='cancel'
          onClick={this.onClose}
          text='Cancel'
        />
      )
    ];
  }

  public render() {
    const { isBisectDialogShowing } = this.props.appState;
    const { startIndex, endIndex, allVersions } = this.state;

    return (
      <Dialog
        isOpen={isBisectDialogShowing}
        onClose={this.onClose}
        title='Start a bisect session'
        className='dialog-add-version'
      >
        <div className='bp3-dialog-body'>
          <Label>
            Earliest Version
            <ElectronVersionSelect
              filterable={true}
              items={allVersions}
              itemRenderer={renderItem}
              itemPredicate={filterItem}
              onItemSelect={this.onBeginSelect}
              noResults={<MenuItem disabled={true} text='No results.' />}
            >
              <Button
                text={startIndex ? `v${allVersions[startIndex].version}` : ``}
                icon={startIndex ? getItemIcon(allVersions[startIndex]) : 'small-minus'}
                fill={true}
              />
            </ElectronVersionSelect>
          </Label>
          <Label>
            Latest Version
            <ElectronVersionSelect
              filterable={true}
              items={allVersions.slice(0, startIndex!)}
              itemRenderer={renderItem}
              itemPredicate={filterItem}
              onItemSelect={this.onEndSelect}
              noResults={<MenuItem disabled={true} text='No results.' />}
              disabled={!startIndex}
            >
              <Button
                text={endIndex ? `v${allVersions[endIndex].version}` : ``}
                icon={endIndex ? getItemIcon(allVersions[endIndex]) : 'small-minus'}
                fill={true}
                disabled={!startIndex}
              />
            </ElectronVersionSelect>
          </Label>
        </div>
        <div className='bp3-dialog-footer'>
          <div className='bp3-dialog-footer-actions'>
            {this.buttons}
          </div>
        </div>
      </Dialog>
    );
  }
}
