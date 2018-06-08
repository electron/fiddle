import * as React from 'react';
import { observer } from 'mobx-react';

import { EditorTitle } from './editor-title';
import { Commands } from './commands';
import { AppState } from '../app';
import { Output } from './output';
import { TokenDialog } from './token-dialog';

export interface HeaderProps {
  appState: AppState;
}
@observer
export class Header extends React.Component<HeaderProps, {}> {
  public render() {
    return [
      <Commands key='commands' appState={this.props.appState} />,
      <Output key='output' appState={this.props.appState} />,
      <EditorTitle key='titles' />,
      <TokenDialog key='tokenDialog' appState={this.props.appState} />
    ];
  }
}
