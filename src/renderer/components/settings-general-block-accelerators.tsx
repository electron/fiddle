import * as React from 'react';

import { Callout, Checkbox, FormGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { BlockableAccelerator } from '../../interfaces';
import { AppState } from '../state';

interface BlockAcceleratorsSettingsProps {
  appState: AppState;
}

/**
 * Settings content to block keyboard accelerators.
 *
 * @class BlockAcceleratorsSettings
 * @extends {React.Component<BlockAcceleratorsSettingsProps>}
 */
export const BlockAcceleratorsSettings = observer(
  class BlockAcceleratorsSettings extends React.Component<BlockAcceleratorsSettingsProps> {
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
     * @param {React.FormEvent<HTMLInputElement>} event
     */
    public handleBlockAcceleratorChange(
      event: React.FormEvent<HTMLInputElement>,
    ) {
      const { checked, value } = event.currentTarget;
      if (checked) {
        this.props.appState.addAcceleratorToBlock(
          value as BlockableAccelerator,
        );
      } else {
        this.props.appState.removeAcceleratorToBlock(
          value as BlockableAccelerator,
        );
      }
    }

    public render() {
      const { acceleratorsToBlock } = this.props.appState;

      const blockAcceleratorsInstructions = `
        Any keyboard shortcuts checked below will be disabled.`.trim();

      return (
        <div>
          <h4>Block Keyboard Shortcuts</h4>
          <Callout>
            <FormGroup>
              <p>{blockAcceleratorsInstructions}</p>
              <Checkbox
                checked={acceleratorsToBlock.includes(
                  BlockableAccelerator.save,
                )}
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
  },
);
