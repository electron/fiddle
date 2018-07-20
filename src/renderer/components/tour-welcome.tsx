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

const welcomeTour: Set<TourScriptStep> = new Set([
  {
    selector: 'div.mosaic-window.main',
    text: 'Main editor'
  }
]);

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
        <Tour tour={welcomeTour} />
      );
    }
  }
}
