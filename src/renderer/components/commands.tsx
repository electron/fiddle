import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { AddressBar } from './address-bar';
import { PublishButton } from './publish-button';
import { Runner } from './runner';
import { VersionChooser } from './version-chooser';

export interface CommandsProps {
  appState: AppState;
}

/**
 * The command bar, containing all the buttons doing
 * all the things
 *
 * @class Commands
 * @extends {React.Component<CommandsProps, {}>}
 */
@observer
export class Commands extends React.Component<CommandsProps, {}> {
  constructor(props: CommandsProps) {
    super(props);
  }

  public render() {
    const { appState } = this.props;

    return (
      <div className='commands'>
        <div>
          <Runner appState={appState} />
          <VersionChooser appState={appState} />
        </div>
        <div>
          <AddressBar appState={appState} />
          <PublishButton appState={appState} />
          <button className='button' onClick={() => appState.toggleConsole()}>
            <FontAwesomeIcon icon='terminal' />
          </button>
        </div>
      </div>
    );
  }
}
