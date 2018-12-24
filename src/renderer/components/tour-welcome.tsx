import { Button } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { Dialog } from './dialog';
import { Tour, TourScriptStep, TourStepGetButtonParams } from './tour';

export interface WelcomeTourProps {
  appState: AppState;
}

export interface WelcomeTourState {
  isTourStarted: boolean;
}

/**
 * This is our "Welcome to Electron Fiddle" Tour. It includes both an intro to
 * the app and a short intro to Electron.
 *
 * @returns {Set<TourScriptStep>}
 */
function getWelcomeTour(): Set<TourScriptStep> {
  return new Set([
    {
      name: 'fiddle-editors',
      selector: 'div.mosaic-root',
      content: (
        <div>
          <h4>📝 Fiddle Editors</h4>
          <p>
            Electron Fiddle allows you to build little experiments and mini-apps with
            Electron. Each Fiddle has three files: A main script, a renderer script,
            and an HTML file.
          </p>
          <p>
            If you <code>require()</code> a module, Fiddle will install
            it automatically. It will also automatically provide you with autocomplete
            information for the <code>electron</code> module.
          </p>
        </div>
      )
    },
    {
      name: 'select-versions',
      selector: 'select.select-versions',
      content: (
        <div>
          <h4>📇 Choose an Electron Version</h4>
          <p>
            Electron Fiddle knows about all released Electron versions, downloading
            your versions automatically in the background.
          </p>
          <p>
            Open the preferences to see all available versions and delete those previously
            downloaded.
          </p>
        </div>
      )
    },
    {
      name: 'button-run',
      selector: 'button.button-run',
      content: (
        <div>
          <h4>🚀 Run Your Fiddle</h4>
          <p>
            Hit this button to give your Fiddle a try and start it.
          </p>
        </div>
      )
    },
    {
      name: 'button-publish',
      selector: 'button.button-publish',
      content: (
        <div>
          <h4>🗺 Share Your Fiddle</h4>
          <p>
            Like what you've built? You can save your Fiddle as a public GitHub Gist,
            allowing other users to load it by pasting the URL into the address bar.
            If they don't have Electron Fiddle, they can see and download your code
            directly from GitHub.
          </p>
          <p>
            You can also package your Fiddle as a standalone binary or as an installer
            from the "Tasks" menu.
          </p>
        </div>
      )
    },
    {
      name: 'first-time-electron',
      selector: 'div.mosaic-root',
      content: (
        <div>
          <h4>👋 Getting Started With Electron?</h4>
          <p>
            We've finished our tour of Electron Fiddle, but if this is your
            first time using Electron, we could introduce you to its basics.
            Interested?
          </p>
        </div>
      ),
      getButtons: ({ stop, advance }: TourStepGetButtonParams): Array<JSX.Element> => {
        return [
          <Button key='btn-stop' onClick={stop} text={`I'm good!`} />,
          <Button key='btn-adv' onClick={advance} text='Electron Basics' />
        ];
      }
    },
    {
      name: 'main-editor',
      selector: 'div.mosaic-window.main',
      content: (
        <div>
          <h4>📝 Main Script</h4>
          <p>
            Every Electron app starts with a main script, very similar to how
            a Node.js application is started. The main script runs in the "main
            process". To display a user interface, the main process creates renderer
            processes – usually in the form of windows, which Electron calls
            <code>BrowserWindow</code>.
          </p>
          <p>
            To get started, pretend that the main process is just like a Node.js
            process. All APIs and features found in Electron are accessible through
            the <code>electron</code> module, which can be required like any other
            Node.js module.
          </p>
          <p>
            The default fiddle creates a new <code>BrowserWindow</code> and loads
            an HTML file.
          </p>
        </div>
      )
    },
    {
      name: 'html-editor',
      selector: 'div.mosaic-window.html',
      content: (
        <div>
          <h4>📝 HTML</h4>
          <p>
            In the default fiddle, this HTML file is loaded in the
            <code>BrowserWindow</code>. Any HTML, CSS, or JavaScript that works
            in a browser will work here, too. In addition, Electron allows you
            to execute Node.js code. Take a close look at the
             <code>&lt;script /&gt;</code> tag and notice how we can call <code>
            require()</code> like we would in Node.js.
          </p>
        </div>
      )
    },
    {
      name: 'renderer-editor',
      selector: 'div.mosaic-window.renderer',
      content: (
        <div>
          <h4>📝  Renderer Script</h4>
          <p>
            This is the script we just required from the HTML file. In here, you can
            do anything that works in Node.js <i>and</i> anything that works in a browser.
          </p>
          <p>
            By the way: If you want to use an <code>npm</code> module here, just
            <code>require</code> it. Electron Fiddle will automatically detect that you
            requested a module and install it as soon as you run your fiddle.
          </p>
        </div>
      )
    }
  ]);
}

/**
 * The "Welcome to Electron Fiddle" Tour.
 *
 * @export
 * @class WelcomeTour
 * @extends {React.Component<WelcomeTourProps, WelcomeTourState>}
 */
@observer
export class WelcomeTour extends React.Component<WelcomeTourProps, WelcomeTourState> {
  constructor(props: WelcomeTourProps) {
    super(props);

    this.stopTour = this.stopTour.bind(this);
    this.startTour = this.startTour.bind(this);

    this.state = {
      isTourStarted: false
    };
  }

  /**
   * Stops the tour, closing it.
   */
  public stopTour() {
    this.props.appState.disableTour();
  }

  /**
   * Starts the tour.
   */
  public startTour() {
    this.setState({ isTourStarted: true });
  }

  public render() {
    const { isTourShowing } = this.props.appState;
    const { isTourStarted } = this.state;

    if (!isTourShowing) return null;

    if (!isTourStarted) {
      const buttons = [
        <Button key='cancel' onClick={this.stopTour} text={`I'll figure it out`} />,
        <Button key='ok' onClick={this.startTour} text='Show me around' />
      ];

      return (
        <Dialog
          key='welcome-tour-dialog'
          isCentered={true}
          isShowing={true}
          isShowingBackdrop={true}
          buttons={buttons}
        >
          <h4>🙋‍ Hey There!</h4>
          <p>
            Welcome to Electron Fiddle! If you're new to the app,
            we'd like to give you a brief tour of its features.
          </p>
          <p>
            We won't show this dialog again, but you can always
            find the tour in the Help menu.
          </p>
        </Dialog>
      );
    } else {
      return (
        <Tour tour={getWelcomeTour()} onStop={this.stopTour} />
      );
    }
  }
}
