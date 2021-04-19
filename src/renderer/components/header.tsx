import * as React from 'react';

import { AppState } from '../state';
import { ChromeMac } from './chrome-mac';
import { Commands } from './commands';
import { EditorMosaic } from '../editor-mosaic';
import { WelcomeTour } from './tour-welcome';

interface HeaderProps {
  appState: AppState;
  editorMosaic: EditorMosaic;
}

/**
 * Everything above the editors, so buttons and the address bar.
 *
 * @class Header
 * @extends {React.Component<HeaderProps>}
 */
export class Header extends React.Component<HeaderProps> {
  public render() {
    const { appState, editorMosaic } = this.props;
    return (
      <>
        <ChromeMac appState={appState} />
        <header id="header">
          <Commands
            appState={appState}
            editorMosaic={editorMosaic}
            key="commands"
          />
        </header>
        <WelcomeTour appState={appState} />
      </>
    );
  }
}
