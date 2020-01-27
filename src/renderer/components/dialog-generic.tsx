
import { Alert, IconName, Intent} from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { GenericDialogType } from '../../../src/interfaces';
import { AppState } from '../state';

export interface GenericDialogProps {
  appState: AppState;
}

export interface GenericDialogState {
}

/**
 * The token dialog prompts the user to either continue or cancel the operation.
 *
 * @export
 * @class GenericDialog
 * @extends {React.Component<GenericDialogProps, GenericDialogState>}
 */
@observer
export class GenericDialog extends React.Component<GenericDialogProps, GenericDialogState> {
  constructor(props: GenericDialogProps) {
    super(props);

    this.onClose = this.onClose.bind(this);
  }

  public onClose(result: boolean) {
    this.props.appState.genericDialogLastResult = result;
    this.props.appState.toggleGenericDialog();
  }

  public render() {
    const { isGenericDialogShowing, genericDialogOptions } = this.props.appState;
    const {type, ok, cancel, label} = genericDialogOptions;

    let intent: Intent;
    let icon: IconName;
    switch (type) {
      case GenericDialogType.warning:
        intent = Intent.DANGER;
        icon = 'warning-sign';
        break;
      case GenericDialogType.confirm:
        intent = Intent.PRIMARY;
        icon = 'help';
        break;
      case GenericDialogType.message:
        intent = Intent.SUCCESS;
        icon = 'info-sign';
        break;
      default:
        intent = Intent.NONE;
        icon = 'help';
        break;
    }
    return (
      <Alert
        isOpen={isGenericDialogShowing}
        onClose={this.onClose}
        icon={icon}
        confirmButtonText={ok}
        cancelButtonText={cancel}
        intent={intent}
      >
        <p>{label}</p>
      </Alert>
    );
  }
}
