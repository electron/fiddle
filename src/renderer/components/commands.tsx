import * as React from 'react';
import { observer } from 'mobx-react';

import { Runner } from './runner';
import { VersionChooser } from './version-chooser';
import { AppState } from '../app';

export interface CommandsProps {
  appState: AppState;
}

@observer
export class Commands extends React.Component<CommandsProps, {}> {
  constructor(props) {
    super(props);
  }

  public render() {
    return (
      <div className='commands'>
        <Runner appState={this.props.appState} />
        <VersionChooser appState={this.props.appState} />
      </div>
    )
  }
}
