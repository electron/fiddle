import * as React from 'react';

import { Button, Callout, Icon } from '@blueprintjs/core';
import { remote } from 'electron';

import { renderMoreDocumentation } from './more-information';
import { getSubsetOnly } from './subset-only';

/**
 * Show and hide button examples, only rendered on macOS
 *
 * @returns {JSX.Element | null}
 */
function ShowHide() {
  if (process.platform !== 'darwin') return null;

  const onClick = () => {
    remote.app.hide();
    setTimeout(() => {
      remote.app.show();
      remote.app.focus();
    }, 1500);
  };

  return (
    <>
      <p>This button hides Electron Fiddle right away, showing it again in two seconds.</p>
      <Button
        id='show-hide'
        icon='eye-off'
        text='Hide Electron Fiddle'
        onClick={onClick}
      />
    </>
  );
}
export function ShowMeApp(_props: any): JSX.Element {
  const [ secondsLeft, setSeconds ] = React.useState(-1);

  const playFocus = () => {
    setSeconds(3);
    setTimeout(() => setSeconds(2), 1000);
    setTimeout(() => setSeconds(1), 2000);
    setTimeout(() => {
      remote.app.focus();
      setSeconds(-1);
    }, 3000);
  };

  const [ paths, setPaths ] = React.useState('');
  const playPaths = () => {
    const pathsToQuery = [
      'home',
      'appData',
      'userData',
      'temp',
      'downloads',
      'desktop'
    ];

    let result = '';
    pathsToQuery.forEach((item) => {
      result += `${item}: ${remote.app.getPath(item as any)}\n`;
    });

    setPaths(result);
  };

  const [ metrics, setMetrics ] = React.useState('');
  const playMetrics = () => {
    setMetrics(JSON.stringify(remote.app.getAppMetrics(), undefined, 2));
  };

  return (
    <>
      <Icon icon='help' iconSize={40} style={{ float: 'left', margin: '0 10px 0 0' }} />
      <p className='bp3r-running-text'>
        The <code>app</code> module controls the app's application life-cycle. Most of the
        events and methods available on this module are responsible for handling how your
        interacts with the operating system or to set application-wide settings.
      </p>
      <h3>API Demos</h3>
      {getSubsetOnly('app')}
      <Callout
        title='Hiding, Showing, Focussing'
        icon='eye-open'
      >
        <p>
          The app can ask the operating system for window focus. On macOS, it can additionally
          request that the app be hidden or shown. Give it a try: Click on the button below,
          focus another app, and wait for two seconds to see Electron Fiddle become the focused
          app again.
        </p>
        <Button
          id='focus'
          icon='lightbulb'
          text={`Focus Electron Fiddle${secondsLeft > 0 ? ` in ${secondsLeft}s` : ''}`}
          onClick={playFocus}
        />
        <ShowHide />
      </Callout>
      <Callout
        title='Paths'
        icon='folder-open'
      >
        <p>
          Need to query information about various paths in a cross-platform manner? Electron
          can help. The button queries the operating system for some of them.
        </p>
        <Button
          id='special-paths'
          icon='play'
          text={`Get special directory paths`}
          onClick={playPaths}
        />
        <pre id='special-paths-content'>
          {paths}
        </pre>
      </Callout>
      <Callout
        title='Process & Device Information'
        icon='pulse'
      >
        <p>
          Need to query information about the process or system? The <code>app</code> module lets
          developers query for information about the running app, hardware, and operating system.
          A good example are process metrics.
        </p>
        <Button
          id='process-metrics'
          icon='play'
          text={`Get process metrics`}
          onClick={playMetrics}
        />
        <pre id='process-metrics-content'>
          {metrics}
        </pre>
      </Callout>
      {renderMoreDocumentation()}
    </>
  );
}
