import { Alert, IconName, InputGroup, Intent } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { GenericDialogType } from '../../../src/interfaces';
import { AppState } from '../state';

interface GenericDialogProps {
  appState: AppState;
}

/**
 * The token dialog prompts the user to either continue or cancel the operation.
 *
 * @export
 * @class GenericDialog
 * @extends {React.Component<GenericDialogProps, GenericDialogState>}
 */
@observer
export class GenericDialog extends React.Component<GenericDialogProps> {
  constructor(props: GenericDialogProps) {
    super(props);

    this.onClose = this.onClose.bind(this);
  }

  public onClose(result: boolean) {
    const input = document.getElementById('input') as HTMLInputElement;

    this.props.appState.genericDialogLastInput =
      input && input.value !== '' ? input.value : null;
    this.props.appState.genericDialogLastResult = result;
    this.props.appState.isGenericDialogShowing = false;
  }

  public render() {
    const {
      isGenericDialogShowing,
      genericDialogOptions,
    } = this.props.appState;
    const {
      type,
      ok,
      cancel,
      label,
      wantsInput,
      placeholder,
    } = genericDialogOptions;

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
      case GenericDialogType.success:
        intent = Intent.SUCCESS;
        icon = 'info-sign';
        break;
      default:
        intent = Intent.NONE;
        icon = 'help';
        break;
    }

    let dialogInput;
    if (wantsInput) {
      dialogInput = placeholder ? (
        <InputGroup id="input" placeholder={placeholder} />
      ) : (
        <InputGroup id="input" />
      );
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
        {wantsInput && dialogInput}
      </Alert>
    );
  }
}
