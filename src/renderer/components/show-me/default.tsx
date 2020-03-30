import { Button, Icon } from '@blueprintjs/core';
import * as React from 'react';

import { DocsDemoPage } from '../../../interfaces';
import { AppState } from '../../state';
import { DOCS_DEMO_COMPONENTS, DOCS_DEMO_NAMES } from './index';
import { renderMoreDocumentation } from './more-information';

export function ShowMeDefault(props: { appState: AppState }): JSX.Element {
  const showMeMenu: Array<JSX.Element> = Object.keys(DOCS_DEMO_COMPONENTS)
    .filter((key) => key !== DocsDemoPage.DEFAULT)
    .map((key) => {
      return (
        <li key={key}>
          <Button
            minimal={true}
            icon='play'
            text={DOCS_DEMO_NAMES[key]}
            onClick={() => (props.appState.currentDocsDemoPage = key as DocsDemoPage)}
          />
        </li>
      );
  });

  return (
    <>
      <Icon icon='help' iconSize={40} style={{ float: 'left', margin: '0 10px 0 0' }} />
      <p className='bp3r-running-text'>
        This panel offers useful information about Electron APIs – and
        easy way to try some of the methods it offers. Fiddle has an example fiddle
        for every module available in Electron.
      </p>
      <p>
        Clicking on any of the modules below will open up a fiddle showcasing
        that particular module.
      </p>
      <ul className='show-me-list'>
        {...showMeMenu}
      </ul>
      {renderMoreDocumentation()}
    </>
  );
}
