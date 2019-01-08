import { Button, Classes, Dialog } from '@blueprintjs/core';
import * as React from 'react';

import { positionForRect } from '../../utils/position-for-rect';

export interface TourScriptStep {
  name: string;
  selector: string;
  title: string;
  content: JSX.Element;
  getButtons?: (handlers: TourStepGetButtonParams) => Array<JSX.Element>;
}

export interface TourProps {
  tour: Set<TourScriptStep>;
  onStop: () => void;
}

export interface TourState {
  tour: IterableIterator<Array<TourScriptStep>>;
  step: TourScriptStep | null;
  i: number;
}

export interface TourStepGetButtonParams {
  stop: () => void;
  advance: () => void;
}

export class Tour extends React.Component<TourProps, TourState> {
  private resizeHandle = 0;

  constructor(props: TourProps) {
    super(props);

    this.advance = this.advance.bind(this);
    this.stop = this.stop.bind(this);
    this.onResize = this.onResize.bind(this);

    this.state = {
      tour: props.tour.entries(),
      step: null,
      i: 0
    };
  }

  /**
   * Handles a resize of the window.
   */
  public onResize() {
    if (!this.resizeHandle) {
      this.resizeHandle = window.setTimeout(() => {
        this.forceUpdate();
        this.resizeHandle = 0;
      }, 100);
    }
  }

  /**
   * Component was mounted: Sign up for the window's "resize"
   * event and move to the first step of the tour.
   */
  public componentDidMount() {
    this.advance();

    window.addEventListener('resize', this.onResize);
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
  }

  /**
   * Moves the tour to the next step
   */
  public advance() {
    const { done, value } = this.state.tour.next();
    const step = done ? null : value[0];

    this.setState({ step, i: this.state.i + 1 });
  }

  /**
   * Stops the tour
   */
  public stop() {
    this.props.onStop();
  }

  public render() {
    const { step } = this.state;

    if (!step) return null;

    return (
      <div className='tour'>
        {this.getStep(step)}
      </div>
    );
  }

  /**
   * Return buttons for the dialog for the current step
   * of the tour. By default, we just return a continue/stop
   * combo
   *
   * @param {TourScriptStep} { getButtons }
   * @returns {Array<JSX.Element>}
   */
  private getButtons({ getButtons }: TourScriptStep): Array<JSX.Element> {
    // Did the step bring its own buttons?
    if (getButtons) {
      return getButtons({
        stop: this.stop,
        advance: this.advance
      });
    }

    // No? Fine! Are we at the end of the tour?
    return this.props.tour.size === this.state.i
      ? [(
        <Button
          icon='tick-circle'
          onClick={this.stop}
          key='btn-stop'
          text='Finish Tour'
        />
      )] : [
        (
          <Button
            icon='stop'
            key='btn-stop'
            onClick={this.stop}
            text='Stop Tour'
          />
        ), (
          <Button
            icon='step-forward'
            key='btn-adv'
            onClick={this.advance}
            text='Continue'
          />
        )
      ];
  }

  /**
   * Renders the dialog for the current step of the tour.
   *
   * @param {TourScriptStep} { content }
   * @param {ClientRect} rect
   * @returns {JSX.Element}
   */
  private getDialogForStep(step: TourScriptStep, rect: ClientRect): JSX.Element {
    const buttons = this.getButtons(step);
    const size = { width: 400, height: 300 };
    const margin = 10;
    const position = positionForRect(rect, size);
    const style: React.CSSProperties = {
      position: 'absolute',
      top: position.top,
      left: position.left,
      width: size.width - margin,
      margin: `${margin}px`,
      zIndex: 1000,
    };

    return (
      <Dialog
        key={step.name}
        isOpen={true}
        style={style}
        portalClassName='tour-portal'
        backdropProps={{ style: { visibility: 'hidden' }}}
      >
        <div className={Classes.DIALOG_HEADER}>
          <h4 className={Classes.HEADING}>
            {step.title}
          </h4>
        </div>
        <div className={Classes.DIALOG_BODY}>
          {step.content}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            {buttons}
          </div>
        </div>
      </Dialog>
    );
  }

  /**
   * Returns the "mask" for a given step.
   *
   * @param {TourScriptStep} { selector, text }
   * @returns {(JSX.Element | null)}
   */
  private getStep(step: TourScriptStep): JSX.Element | null {
    const { selector } = step;
    const element = document.querySelector(selector) || document.body!;
    const rect = element.getBoundingClientRect();
    const { top, left, width, height } = rect;

    return (
      <>
        {this.getDialogForStep(step, rect)}
        <svg height='100%' width='100%'>
          <rect fill='rgba(0, 0, 0, 0.65)' x='0' y='0' mask='url(#mask)' height='100%' width='100%'/>
          <mask id='mask' maskUnits='userSpaceOnUse' maskContentUnits='userSpaceOnUse'>
            <rect className='bg' x='0' y='0' fill='white' height='100%' width='100%' />
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              fill='black'
              rx='5'
              ry='5'
              strokeWidth='5'
              stroke='black'
            />
          </mask>
        </svg>
      </>
    );
  }
}
