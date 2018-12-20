
import { Alert, Intent } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';

export interface WarningDialogProps {
  appState: AppState;
}

export interface WarningDialogState {
}

/**
 * The token dialog asks the user for a GitHub Personal Access Token.
 * It's also responsible for checking if the token is correct.
 *
 * @export
 * @class WarningDialog
 * @extends {React.Component<WarningDialogProps, WarningDialogState>}
 */
@observer
export class WarningDialog extends React.Component<WarningDialogProps, WarningDialogState> {
  constructor(props: WarningDialogProps) {
    super(props);

    this.onClose = this.onClose.bind(this);
  }

  public onClose(result: boolean) {
    this.props.appState.warningDialogLastResult = result;
    this.props.appState.toogleWarningDialog();
  }

  public render() {
    const { isWarningDialogShowing, warningDialogTexts } = this.props.appState;

    return (
      <Alert
        isOpen={isWarningDialogShowing}
        onClose={this.onClose}
        icon='warning-sign'
        confirmButtonText={warningDialogTexts.ok}
        cancelButtonText={warningDialogTexts.cancel}
        intent={Intent.DANGER}
      >
        <p>{warningDialogTexts.label}</p>
      </Alert>
    );
  }
}
