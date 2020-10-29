import { Callout, Checkbox, FormGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';
import { BlockableAccelerator } from '../../interfaces';

import { AppState } from '../state';

export interface BlockAcceleratorsSettingsProps {
  appState: AppState;
}

/**
 * Settings content to block keyboard accelerators.
 *
 * @class BlockAcceleratorsSettings
 * @extends {React.Component<BlockAcceleratorsSettingsProps>}
 */
@observer
export class BlockAcceleratorsSettings extends React.Component<
  BlockAcceleratorsSettingsProps
> {
  constructor(props: BlockAcceleratorsSettingsProps) {
    super(props);

    this.handleBlockAcceleratorChange = this.handleBlockAcceleratorChange.bind(
      this,
    );
  }

  /**
   * Handles a change on whether a keyboard shortcut should be blocked
   * before fiddle is executed.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleBlockAcceleratorChange(
    event: React.FormEvent<HTMLInputElement>,
  ) {
    const { checked, value } = event.currentTarget;
    if (checked) {
      this.props.appState.addAcceleratorToBlock(value as BlockableAccelerator);
    } else {
      this.props.appState.removeAcceleratorToBlock(
        value as BlockableAccelerator,
      );
    }
  }

  public render() {
    const { acceleratorsToBlock } = this.props.appState;

    const blockAcceleratorsLabel = `
      Any keyboard shortcuts checked below will be disabled.`.trim();

    return (
      <div>
        <h4>Block Keyboard Shortcuts</h4>
        <Callout>
          <FormGroup label={blockAcceleratorsLabel}>
            <Checkbox
              checked={acceleratorsToBlock.includes(BlockableAccelerator.save)}
              label="Save"
              value={BlockableAccelerator.save}
              onChange={this.handleBlockAcceleratorChange}
            />
            <Checkbox
              checked={acceleratorsToBlock.includes(
                BlockableAccelerator.saveAs,
              )}
              label="Save as"
              value={BlockableAccelerator.saveAs}
              onChange={this.handleBlockAcceleratorChange}
            />
          </FormGroup>
        </Callout>
      </div>
    );
  }
}
