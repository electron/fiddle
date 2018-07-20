import * as React from 'react';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { TourScriptStep, Tour } from './tour';
import { Dialog } from './dialog';

export interface WelcomeTourProps {
  appState: AppState;
}

export interface WelcomeTourState {
  isTourStarted: boolean;
}

function getWelcomeTour(): Set<TourScriptStep> {
  return new Set([
    {
      selector: 'div.mosaic-root',
      content: (
        <div>
          <h4>Fiddle Editors</h4>
          <p>
            Electron Fiddle allows you to build little experiments and mini-apps with
            Electron. Each Fiddle has three files: A main script, a renderer script,
            and an HTML file.
          </p>
        </div>
      )
    },
    {
      selector: 'div.mosaic-window.main',
      content: (
        <div>
          <h4>Main Script</h4>
          <p>
            Every Electron app starts with a main script, very similar to how
            a Node.js application is started. That main script runs in the "main
            process". To display a user interface, the main process creates renderer
            processes – usually in the form of windows.
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
    }
  ]);
}

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

  public stopTour() {
    this.props.appState.isTourShowing = false;
  }

  public startTour() {
    this.setState({ isTourStarted: true });
  }

  public render() {
    const { isTourShowing } = this.props.appState;
    const { isTourStarted } = this.state;

    if (!isTourShowing) return null;

    if (!isTourStarted) {
      return (
        <Dialog
          key='welcome-tour-dialog'
          isCentered={true}
          isShowing={true}
          isShowingBackdrop={true}
          onConfirm={this.startTour}
          onClose={this.stopTour}
        >
          <span>Would you like to start the tour?</span>
        </Dialog>
      );
    } else {
      return (
        <Tour tour={getWelcomeTour()} onStop={this.stopTour} />
      );
    }
  }
}
