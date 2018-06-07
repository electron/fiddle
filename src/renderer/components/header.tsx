import * as React from 'react';
import { observer } from 'mobx-react';

import { EditorTitle } from './editor-title';
import { Commands } from './commands';
import { AppState } from '../app';
import { Output } from './output';

export interface HeaderProps {
  appState: AppState;
}
@observer
export class Header extends React.Component<HeaderProps, {}> {
  public render() {
    return [
      <Commands  appState={this.props.appState} />,
      <Output appState={this.props.appState} />,
      <EditorTitle />
    ];
  }
}
